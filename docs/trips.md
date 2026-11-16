# Viajes (Fase 3)

Cubre las pantallas 4 y 5 del mockup: viaje en curso y cierre con la **ganancia real**. Cierra el ciclo completo: encontrar → negociar → reservar → **entregar → cobrar**.

## Ciclo de vida

```
negociación booked ──► scheduled ──► at_pickup ──► in_transit ──► delivered ──(POD)──► completed
                           └──────────┴─────► cancelled (solo antes de cargar; libera la carga)
```

- **Creación automática:** cuando el broker confirma la reserva, el workflow de negociación crea el viaje (`TripsService.createFromNegotiation`, idempotente) **antes** de marcar la negociación como `booked`. Así los clientes nunca ven "reservada" sin su viaje.
- **Orden estricto:** Recogida → En ruta → Entrega (`TRIP_TRANSITIONS` en `@dispatcher/shared`). Las transiciones son atómicas (`updateMany where status = …`). Error: `TRIP_INVALID_STATE`.
- **Cierre:** solo desde `delivered` **y** con un POD subido (`canCompleteTrip`). Error: `POD_REQUIRED`. Al cerrar, la ganancia real queda **congelada**: no se pueden agregar ni borrar gastos.
- **Cancelar:** solo `scheduled` o `at_pickup`. La carga vuelve a `available` si la recogida aún no pasó. Una carga ya cargada no se cancela.
- **Código humano:** `TR-<n>`, a partir de una secuencia de Postgres que empieza en 1001.

## Dinero (`tripFinancials`)

| Concepto | Cálculo |
|---|---|
| Tarifa final | Tarifa acordada con el broker |
| Costos estimados | (km con carga + deadhead) × costo/km del vehículo, al reservar |
| Gastos reales | Suma de los gastos registrados (combustible, peajes, estacionamiento, mantenimiento, lumper, otros) |
| **Ganancia real** | Tarifa − gastos reales |
| Margen final | Ganancia real ÷ tarifa |

Ejemplo del mockup: CA$1,350 − CA$532 = **CA$818 (60.6 %)**. La "ganancia real" solo descuenta lo que el transportista registra. Los costos fijos (seguro, depreciación) se verán en los reportes de la Fase 4.

## GPS y ETA

- **Rastreo:** la app comparte la ubicación **en primer plano mientras la pantalla del viaje está abierta**, con precisión balanceada, cada ~200 m o 30 s. Los puntos se envían por lotes (`POST /v1/trips/:id/locations`, hasta 100 puntos).
- **Datos guardados:** la API conserva el último punto, los km restantes y la ETA, y actualiza también la última ubicación del vehículo (para el deadhead de las cargas siguientes).
- **ETA:** km restantes (haversine × 1.25) ÷ velocidad observada (si está entre 30 y 110 km/h) o 75 km/h por defecto. Antes de cargar mide hasta la recogida; después, hasta el destino.
- **Rastreo en segundo plano:** durante todo el viaje queda como **siguiente paso** (ver [ADR-0016](./adr/0016-trip-tracking.md)). Requiere permiso "Siempre", `expo-task-manager`, una justificación para la revisión de Apple y consentimiento explícito.

## Documentos

| Tipo | Origen |
|---|---|
| Rate Confirmation | **Generado** por la API en PDF (pdfkit) al crear el viaje. Las cargas simuladas llevan la marca de agua **DEMO** |
| POD, BOL, recibos, otros | Foto (cámara o galería) subida desde la app |

**Flujo de subida** ([ADR-0015](./adr/0015-document-storage.md)):

```
App ── POST /trips/:id/documents/upload-url {type, mimeType, sizeBytes, fileName} ──► API
App ◄── { document (pending), uploadUrl (PUT firmado, 10 min), headers } ─────────── API
App ── PUT bytes ─────────────────────────────────────────────────────────────────► S3
App ── POST /trips/:id/documents/:docId/complete ──► API (HEAD en S3: existe y tamaño ok) ─► uploaded
```

- **Solo metadatos en la API:** el archivo **nunca pasa por la API**; la base guarda únicamente los metadatos.
- **Restricciones de subida:** JPEG, PNG, HEIC o PDF, hasta 15 MB.
- **Clave en S3:** `org/<orgId>/trips/<tripId>/<docId>/<nombre-sanitizado>`.
- **Descarga:** `GET /v1/documents/:id/download-url` devuelve una URL firmada de 5 minutos. En el cliente es una *mutation*, para que cada uso pida una URL nueva.

## Broker

- **Llamar al broker:** usa `tel:` con el teléfono del broker. **Los brokers simulados no tienen teléfono a propósito**, para nunca marcar un número inventado.
- **Calificación:** 1 a 5 estrellas, una vez por viaje (`BROKER_ALREADY_RATED`). Actualiza `brokers.rating_avg`.

## Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/v1/trips?filter=active\|completed\|all`, `/v1/trips/:id` | `trips:read` |
| POST | `/v1/trips/:id/status` `{status}` | `trips:progress` |
| POST | `/v1/trips/:id/locations` `{points[]}` | `trips:progress` |
| POST | `/v1/trips/:id/documents/upload-url` · `/documents/:docId/complete` | `trips:progress` |
| GET | `/v1/documents/:id/download-url` | `trips:read` |
| POST/DELETE | `/v1/trips/:id/expenses[/:expenseId]` | `trips:progress` |
| POST | `/v1/trips/:id/complete` · `/cancel` · `/broker-rating` | `trips:manage` |

`trips:progress` (nuevo) lo tienen todos los roles, incluido el conductor. `trips:manage` lo tienen Owner, Fleet Manager y Dispatcher.

## Mapas en la app

`react-native-maps`: en iOS usa Apple Maps y no necesita clave. **Android necesita `GOOGLE_MAPS_ANDROID_API_KEY`** (en `.env` o en las variables de EAS), que `app.config.ts` inyecta. La línea de la ruta es recta hasta integrar un proveedor de rutas. El botón "Navegar" abre Apple Maps o Google Maps con indicaciones paso a paso.
