# Match de cargas, deadhead y "Cerca de mí" (Fase 1)

El "98% Match" del mockup sale de un **algoritmo determinista y explicable** (`packages/shared/src/matching.ts`), con tests. Cada punto viene con una **razón codificada** que la UI traduce (`domain.matchReason.<código>`). El agente de IA de la Fase 2 **usará este puntaje, no lo inventará**.

## Entradas

| Entrada | De dónde sale |
|---|---|
| Carga | Equipo, peso, tarifa, distancia, recogida, provincias |
| Vehículo | El indicado por `vehicleId` o, si no se indica, el primero de la organización (equipo, capacidad, costo/km) |
| Posición | 1) `lat/lng` de la petición (GPS del teléfono) → 2) último GPS del vehículo (<12 h) → 3) base del vehículo → 4) desconocida |
| Preferencias | `ai_settings`: tarifa mínima/km, margen mínimo, deadhead máximo, provincias preferidas y a evitar |

La resolución vive en `MatchingContextService` (API), que también reutilizará el agente.

## Deadhead

`deadheadKm = distancia en línea recta (haversine) desde la posición hasta la recogida × 1.25`

El factor `ROAD_DISTANCE_FACTOR = 1.25` aproxima la distancia por carretera (ver [ADR-0012](./adr/0012-matching-and-geo.md)). El deadhead **es un costo**: la ganancia estimada usa `(km con carga + km vacíos) × costo/km`.

## Puntaje (0–100)

**Restricciones duras.** Si se incumple alguna, `score = 0` y `compatible = false`:

| Código | Regla |
|---|---|
| `equipment_incompatible` | El vehículo no puede llevar ese equipo. Compatibilidades: cargo van ← cargo van/Sprinter/box truck; Sprinter ← Sprinter/box truck; el resto, solo el mismo tipo |
| `over_capacity` | Peso > capacidad del vehículo |
| `avoided_region` | El origen o el destino está en una provincia a evitar |
| `pickup_passed` | La hora de recogida ya pasó |

**Componentes ponderados** (`MATCH_WEIGHTS`):

| Peso | Componente | Puntos completos | Cero |
|---|---|---|---|
| 35 | Rentabilidad (margen %) | margen ≥ mínimo + 20 pts | margen ≤ 0 |
| 25 | Tarifa por km | ≥ 150 % del mínimo | ≤ 50 % del mínimo |
| 20 | Deadhead | 0 km | ≥ máximo del transportista (posición desconocida: 10 pts) |
| 10 | Recogida | ≤ 72 h | ≥ 7 días |
| 10 | Región | origen o destino preferido (sin preferencias: 5 pts) | región no preferida |

**Razones informativas:**
- Positivas: `equipment_ideal`, `high_margin`, `good_rate`, `short_deadhead`, `pickup_soon`, `preferred_lane`.
- Negativas: `equipment_larger`, `low_margin`, `low_rate`, `long_deadhead`, `deadhead_unknown`, `pickup_far_out`.

Una carga es **oportunidad** si su `score ≥ OPPORTUNITY_THRESHOLD` (70). Así se cuentan en Inicio (app) y en el Dashboard (web).

## Vistas (`GET /v1/loads?view=…`)

| Vista | Qué devuelve | Orden |
|---|---|---|
| `recommended` | Solo cargas compatibles con recogida futura | Score desc. y luego recogida |
| `nearby` | Recogida dentro de `radiusKm` (250 por defecto) de la posición, con **PostGIS** (`ST_DWithin` + índice GiST) | Más cercanas primero |
| `all` | Todas las disponibles | Recogida asc. |

- **Contexto:** la respuesta incluye `context` con el vehículo usado y el origen de la posición (`positionSource`). Sin posición, `nearby` devuelve una lista vacía y la UI pide permiso de ubicación.
- **Paginación:** cursor opaco (offset en base64url), con hasta 500 candidatos puntuados por petición. Los clientes usan `getLoadPages` (infinite query de RTK Query).
- **Detalle:** `GET /v1/loads/:id` agrega `breakdown` (km con carga, km vacíos, costo/km, costos, ganancia y margen).

## Ubicación del teléfono

- **App:** pide la ubicación **solo cuando el usuario toca "Usar mi ubicación"**, en primer plano y sin rastreo en segundo plano. El texto del permiso de iOS está traducido en `apps/mobile/locales/*.json`.
- **Envío:** la posición va en la consulta (`lat/lng`) y además se reporta al vehículo (`POST /v1/vehicles/:id/location`), así la web y los demás dispositivos usan el GPS reciente.
- **Rastreo continuo:** el seguimiento durante un viaje llega en la Fase 3, con su propio consentimiento.

## Cargas manuales y ciudades

- **Ciudades:** las cargas manuales (`POST /v1/loads`) y la base del vehículo usan el catálogo `CANADIAN_CITIES` (`packages/shared/src/geo.ts`), con unas 30 ciudades logísticas de AB, BC, SK, MB, ON, QC y Atlántico. La API resuelve las coordenadas y, si no se envía la distancia, la estima con `estimateRoadKm`.
- **Ciudad fuera del catálogo:** devuelve `VALIDATION_FAILED`, salvo que se envíen coordenadas.
- **Más adelante:** un geocodificador (Mapbox/Google) reemplazará el catálogo cuando se necesiten direcciones libres.
