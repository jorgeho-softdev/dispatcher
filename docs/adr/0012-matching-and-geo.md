# ADR-0012: Match determinista, PostGIS por trigger y deadhead aproximado

- **Estado:** Aceptado
- **Fecha:** 2026-11-15

## Contexto
La Fase 1 debe recomendar cargas ("98% Match"), estimar los km vacíos hasta la recogida (deadhead) y mostrar cargas "Cerca de mí". Aún no hay un proveedor de rutas, ni volumen real de cargas (son simuladas y manuales), y el agente de IA de la Fase 2 deberá razonar sobre estos mismos números.

## Decisión
1. **Match determinista en `@dispatcher/shared`** (`scoreMatch`):
   - Restricciones duras y cinco componentes ponderados.
   - Razones con códigos que cada cliente traduce. No hay ML ni LLM en el puntaje.
   - Se cubre con tests unitarios.
2. **PostGIS:**
   - Columna `loads.origin_geo geography(Point,4326)` con índice GiST.
   - La mantiene un **trigger de base de datos** a partir de `origin_lat/lng`, para que cualquier vía de escritura (Prisma, seed, SQL, futuros ingestores) la mantenga correcta.
   - En Prisma se declara como `Unsupported(...)` y se consulta con `$queryRaw` parametrizado (`Prisma.sql`) solo para la vista `nearby` (`ST_DWithin` + `<->`).
3. **Deadhead = haversine × 1.25** (`ROAD_DISTANCE_FACTOR`), calculado en la API para todas las vistas. Así todas usan la misma cifra.
4. **Ranking en memoria:**
   - Se puntúan hasta 500 candidatos por petición y se pagina con un cursor opaco (offset).
   - Cuando haya volumen, los puntajes se precalcularán en una tabla `load_matches` mediante jobs (BullMQ, Fase 2) y la paginación pasará a ser por cursor sobre esa tabla.
5. **Catálogo de ciudades canadienses** (`CANADIAN_CITIES`) para las cargas manuales y la base del vehículo, en lugar de un geocodificador.
6. **Ubicación del teléfono:** solo en primer plano y a petición del usuario. Se reporta al vehículo (`POST /v1/vehicles/:id/location`) y caduca a las 12 h.

## Alternativas consideradas
- **Calcular el match en SQL:** más rápido a gran escala, pero difícil de explicar, probar y reutilizar en los clientes y el agente.
- **API de rutas (Mapbox/Google) para el deadhead:** es más precisa, pero suma costo y latencia en cada listado. Se usará para el detalle y los viajes cuando se integre.
- **Columna generada (`GENERATED ALWAYS AS`) en lugar de trigger:** Prisma no la modela y genera drift en las migraciones. El trigger es invisible para Prisma y no produce drift (verificado con `migrate dev --create-only`).
- **Geocodificación libre desde ya:** dependencia externa innecesaria mientras las cargas manuales sean pocas.

## Consecuencias
- El puntaje es reproducible y auditable: el agente y la UI muestran el mismo número y las mismas razones.
- El deadhead se desvía de la distancia real por carretera en rutas de montaña (BC); es aceptable para ordenar cargas. El detalle podrá usar distancias reales más adelante.
- Los listados escalan a cientos de cargas por organización. Más allá de eso, toca implementar `load_matches`.
- Las migraciones que toquen `loads.origin_lat/lng` deben conservar el trigger `loads_sync_origin_geo`.
