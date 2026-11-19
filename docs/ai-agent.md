# Agente de IA: negociación asistida (Fase 2)

El agente de IA de HaulGenius negocia tarifas con brokers en nombre del transportista. El principio central:

> **La IA propone; el código decide qué está permitido; el humano aprueba lo que compromete.**

## Piezas

```
                    ┌────────────────────────── API (NestJS) ───────────────────────────┐
App / Web ──REST──► │ NegotiationsService (máquina de estados, transiciones atómicas)    │
                    │   │                                                                │
                    │   ├─► NegotiationStrategy  ─ ClaudeStrategy (LLM, salida estructurada)
                    │   │                         └ RulesStrategy  (determinista / fallback)
                    │   ├─► Policy Engine (packages/shared/negotiation.ts) ◄─ SIEMPRE      │
                    │   ├─► BrokerChannel ─ SimulatedBrokerChannel (MVP) · email (Fase 5) │
                    │   ├─► PushService ─ Expo Push API (textos i18n por usuario)         │
                    │   └─► negotiation_events (auditoría de cada paso)                   │
                    │                                                                    │
                    │ BullMQ (Redis) ◄── jobs: ai-propose · ai-respond · broker-response │
                    └────────────────────────────────────────────────────────────────────┘
```

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| Máquina de estados + Policy Engine | `packages/shared/src/negotiation.ts` | Estados, transiciones válidas, acciones permitidas, `rateBounds`, `checkOffer`, `brokerOfferAcceptable`, `requiresApproval`. Es puro y tiene tests |
| Orquestador | `apps/api/src/modules/negotiations/negotiations.service.ts` | Cada paso del flujo, transiciones atómicas y auditoría |
| Estrategias | `…/strategy/{claude,rules}.strategy.ts` | **Proponen** montos y explicaciones |
| Canal del broker | `…/broker/simulated-broker.channel.ts` | Envía las ofertas y responde de forma asíncrona (simulado y determinista por carga) |
| Worker | `…/negotiations.processor.ts` | Ejecuta los jobs de BullMQ |
| Push | `apps/api/src/modules/notifications/push.service.ts` | Avisa al usuario cuando se requiere su aprobación o termina la negociación |

## Estados

```
start ─► ai_thinking ──(estrategia + política)──► awaiting_send_approval ──aprobar──┐
              ▲                 └────────── semi_auto (sin aprobación) ───────────┤
              │                                                                    ▼
          contraoferta ◄────────────────────────────────────────────── contacting_broker
                                                                        │        │
                                       awaiting_booking_approval ◄─acepta┘        └─rechaza─► rejected
                                                 │ aprobar
                                                 ▼
                                       booking_requested ──confirma──► booked
cualquier estado activo ──cancelar──► cancelled   ·   política / carga no disponible ──► failed
```

- `ai_thinking` existe porque una llamada a Claude tarda segundos. La API responde de inmediato y el trabajo sigue en un job.
- Las transiciones se hacen con `updateMany where status = <esperado>`. Un job duplicado o tardío no hace nada (idempotencia).
- Una carga solo se reserva una vez entre **todas** las organizaciones, con un `UPDATE … WHERE status = 'available'` atómico.

## Policy Engine (determinista, siempre tiene la última palabra)

Con los límites de `ai_settings`, **congelados al iniciar** la negociación para que editar las preferencias después no cambie una negociación en curso:

- **Piso** = `max(tarifa mínima/km × km con carga, costos ÷ (1 − margen mínimo))`, con costos = (km con carga + deadhead) × costo/km.
- **Techo** = `tarifa publicada × (1 + contraoferta máx. %)`.
- **Ofertas salientes:** siempre dentro de `[max(piso, publicada), techo]` y redondeadas a decenas. Lo que se sale del rango se **ajusta y se audita** (`policy_adjusted`). Si ni el techo alcanza el piso, la negociación se **bloquea** (`policy_blocked` → `failed`).
- **Contraofertas del broker:** solo se aceptan si llegan al piso. Una "aceptación" de la IA por debajo del piso se convierte en contraoferta o en retirada.
- **Rondas:** se negocian como máximo 3 (`MAX_NEGOTIATION_ROUNDS`).

## Autonomía (`ai_settings.autonomyLevel`)

| Nivel | Enviar oferta al broker | Reservar |
|---|---|---|
| `assisted` (MVP, por defecto) | Requiere aprobación | Requiere aprobación |
| `semi_auto` | Automático, dentro de los límites | Requiere aprobación |
| `auto` | Por ahora igual que `semi_auto` | Requiere aprobación |

**Reservar siempre requiere aprobación humana** en esta fase.

## Estrategia con Claude

- **Una llamada por decisión** (abrir o responder a una contraoferta) con **salida estructurada** (`client.beta.messages.parse` + `betaZodOutputFormat`). Es un *workflow* orquestado por código, no un agente abierto con herramientas.
- **Modelo y esfuerzo:** `AI_MODEL` (por defecto `claude-opus-5-5`) y `AI_EFFORT` (por defecto `medium`).
- **Prompt de sistema estable**, sin datos variables, cacheado con `cache_control`. El contexto variable (carga, límites, historial) va en el mensaje del usuario.
- **Fallback del servidor ante rechazos de seguridad:** `fallbacks: 'default'` (beta `server-side-fallback-2026-07-01`).
- **Fallback de la aplicación:** si la API falla, rechaza o devuelve algo imposible de parsear, se usa `RulesStrategy`, y el evento lo registra (`payload.fallbackReason`).
- **Idioma:** la explicación (`rationale`) llega en el idioma del usuario. El mensaje al broker va en inglés y **nunca** revela costos, piso, techo ni margen.
- **Auditoría:** cada evento de IA guarda en `payload` el modelo, el esfuerzo y los tokens.

**Selección** (`AI_STRATEGY`): con `auto` (por defecto) se usa Claude si existe `ANTHROPIC_API_KEY`; si no, reglas. `claude` y `rules` fuerzan una u otra. En CI y en los e2e se usa `rules`, para que sean deterministas y sin costo.

## Explicaciones en la UI

Cada evento de IA trae **`rationale`** (texto del LLM, ya en el idioma del usuario) **o** **`reasonCode` + `reasonParams`** (estrategia de reglas), que los clientes traducen con `domain.aiReason.<código>`. Los mensajes con el broker se muestran en la línea de tiempo.

## Broker simulado (MVP)

- **Tarifa máxima oculta:** cada carga tiene una tarifa máxima entre 3 % y 11 % sobre la publicada, determinista por id.
- **Respuestas:**
  - Si la oferta está dentro de esa máxima, **acepta**.
  - Si la oferta pasa del 125 % de la publicada, **rechaza**.
  - En cualquier otro caso **contraoferta** a mitad de camino. Desde la ronda 3 ofrece directamente su máximo.
- **Tiempo de respuesta:** responde después de `BROKER_SIM_DELAY_MS` (4 s por defecto; 0 en los tests).
- **Siempre marcado como DEMO:** la UI lo indica con "Broker simulado (DEMO)".

## Notificaciones push

- **Cuándo se envían:** la API avisa al creador de la negociación en `awaiting_send_approval`, `awaiting_booking_approval`, `booked`, `rejected` y `failed`.
- **Idioma:** los textos (`push.*`) salen de los catálogos compartidos, en el idioma del perfil del usuario.
- **Permiso:** la app lo pide **cuando el usuario inicia su primera negociación**, que es cuando se entiende para qué sirve, y registra el token (`POST /v1/devices`).
- **Al tocar la notificación** se abre la negociación.
- **Requiere** vincular el proyecto de EAS (`npx eas-cli init`); sin eso la app sigue funcionando y solo omite el push.

## Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/v1/negotiations` `{ loadId, vehicleId? }` | `loads:book` |
| GET | `/v1/negotiations?filter=active\|needs_approval\|all` | `loads:read` |
| GET | `/v1/negotiations/:id` (con eventos) | `loads:read` |
| POST | `/v1/negotiations/:id/approve-send` · `/adjust {amount}` · `/approve-booking` · `/cancel` | `loads:book` |
| POST/DELETE | `/v1/devices` `{ token, platform }` / `/v1/devices/:token` | autenticado |

Errores nuevos: `VEHICLE_REQUIRED`, `LOAD_UNAVAILABLE`, `NEGOTIATION_ALREADY_ACTIVE`, `NEGOTIATION_INVALID_STATE`.

## Pendiente (fases siguientes)
- Canal de **email** real con brokers y parseo de respuestas y Rate Confirmations (Fase 5).
- **Rate Confirmation** y creación del **viaje** al reservar (Fase 3).
- Modo `auto` con límites adicionales: presupuesto diario, rutas permitidas y requisitos legales.
- **WebSockets** en lugar de polling en la pantalla de negociación (hoy se consulta cada 2 s solo mientras la IA o el broker trabajan; el push cubre las esperas largas).
