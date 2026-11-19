# ADR-0013: Agente de negociación como workflow con Policy Engine determinista

- **Estado:** Aceptado
- **Fecha:** 2026-11-15

## Contexto
La IA debe negociar tarifas con brokers en nombre del transportista, con autonomía configurable (asistido / semiautomático) y **sin comprometerlo nunca fuera de sus límites**. Cada decisión debe ser auditable y explicable en el idioma del usuario. Además, los costos y la latencia del LLM tienen que ser controlables, y el sistema debe funcionar (y probarse) sin LLM.

## Decisión
- **Workflow orquestado por código, no un agente abierto.**
  - Una máquina de estados explícita (`NEGOTIATION_STATUSES` / `NEGOTIATION_TRANSITIONS` en `@dispatcher/shared`) decide qué ocurre en cada paso.
  - El LLM solo participa en dos puntos de decisión (oferta inicial y respuesta a una contraoferta), con **una llamada de salida estructurada** cada uno.
- **Policy Engine determinista** (`rateBounds`, `checkOffer`, `brokerOfferAcceptable`, `requiresApproval`): se aplica **después** de cada propuesta. Ajusta, convierte o bloquea, y deja todo auditado. El LLM no puede saltarse un límite.
- **Estrategias intercambiables** (`NegotiationStrategy`):
  - `ClaudeStrategy` usa `claude-opus-5-5` con esfuerzo `medium`, salida estructurada con Zod, prompt de sistema cacheado y fallback del servidor ante rechazos.
  - `RulesStrategy` es determinista. Es la estrategia por defecto sin API key, la de CI y el fallback de la aplicación ante cualquier error del LLM.
- **Explicaciones:** `rationale` (texto del LLM en el idioma del usuario) o `reasonCode` + parámetros (traducidos en los clientes).
- **Auditoría completa** en `negotiation_events`: actor, tipo, monto, explicación, mensaje con el broker y `payload` (estrategia, modelo, tokens, motivo del fallback).
- **Límites congelados** al iniciar la negociación (se copian en `negotiations`).
- **Humano en el ciclo:** reservar siempre requiere aprobación. En modo asistido, también cada mensaje al broker.

## Alternativas consideradas
- **Agente con tool use libre** (el LLM decide cuándo contactar al broker, reservar, etc.): más flexible, pero difícil de acotar, auditar y probar. Además es más caro y lento. Es innecesario mientras el flujo es conocido.
- **Managed Agents:** aportan sandbox y sesiones hospedadas que este caso no necesita. El estado vive en nuestra DB.
- **Que el LLM calcule la ganancia o los límites:** los números son críticos y deben ser exactos y reproducibles. Por eso los calcula código con tests.

## Consecuencias
- El sistema funciona y se prueba de punta a punta sin LLM (e2e con `rules`).
- Cambiar de modelo o de proveedor solo toca `ClaudeStrategy`.
- Cada decisión de la IA queda explicada y trazable (la web muestra la auditoría).
- Para negociaciones más ricas (varios canales o búsqueda de backhaul) podría evolucionar a tool use, siempre detrás del mismo Policy Engine.
