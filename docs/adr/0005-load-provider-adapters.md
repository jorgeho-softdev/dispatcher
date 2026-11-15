# ADR-0005: Fuentes de cargas mediante adaptadores (LoadProvider)

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
Las cargas vendrán de varios proveedores (Loadlink, DAT, Truckstop, 123Loadboard, brokers directos), cada uno con su propia API y formato. Hasta tener acuerdos comerciales, el MVP usa cargas simuladas y manuales.

## Decisión
- Interfaz `LoadProvider { source, capabilities, search(criteria) → NormalizedLoad[] }` en `apps/api/src/modules/loads/providers/`.
- `NormalizedLoad` extiende `LoadCreateInput` de `@dispatcher/shared` y agrega `externalId`, `isSimulated`, `broker` y `rawPayload`.
- Restricción `UNIQUE(source, external_id)` para que la ingesta sea idempotente.
- `SimulatedLoadProvider` usa rutas reales de AB/BC/SK y un PRNG determinista (los seeds y tests son reproducibles). Sus cargas siempre llevan `isSimulated=true` y brokers con sufijo "(DEMO)".

## Alternativas consideradas
- **Lógica específica por proveedor dentro del servicio de cargas:** acopla y crece sin control.

## Consecuencias
- Agregar un proveedor equivale a un adaptador nuevo y su registro; matching, negociación y clientes no cambian.
- Solo se integran proveedores **autorizados**: nunca scraping, porque los términos de uso de los load boards lo prohíben.
- La deduplicación entre proveedores (la misma carga en varios boards) queda pendiente para la Fase 5.
