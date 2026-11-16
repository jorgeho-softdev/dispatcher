# Reportes y mapa en vivo (Fase 4)

## Reportes financieros (`/reports` en la web)

**Base:** solo **viajes completados** (`status = completed`), porque la ganancia real es definitiva solo al cerrar el viaje. El periodo se filtra por `completed_at`.

| Métrica | Cálculo |
|---|---|
| Viajes | Cantidad de viajes completados |
| Ingresos | Σ tarifa acordada |
| Gastos | Σ gastos registrados |
| **Ganancia real** | Ingresos − gastos |
| Margen | Ganancia ÷ ingresos |
| Ingreso / km | Ingresos ÷ km con carga |

**Agrupación** (`groupBy`):
- `month`: cronológico, y **rellena los meses vacíos** para que la gráfica no esconda huecos. Los meses son calendario de **Alberta** (`America/Edmonton`).
- `vehicle`, `driver`, `lane` (par de provincias, p. ej. `AB → SK`): ordenados por ganancia.

**Moneda:** se reporta en la moneda de la organización. Los viajes en otra moneda **se excluyen** (todavía no hay tipo de cambio), y la UI lo indica.

**Exportación CSV** (`GET /v1/reports/trips.csv`): una fila por viaje, con BOM UTF-8 para que Excel abra bien los acentos, escape RFC 4180 y **neutralización de fórmulas** (`=`, `+`, `-`, `@` → prefijo `'`) contra la inyección de fórmulas en hojas de cálculo. La exportación a PDF queda pendiente.

**Gráfica** ("Ganancia real por mes"), según la guía de visualización:
- Una sola serie y un solo color (el naranja de marca), sin leyenda; el título nombra la serie.
- Barras de ≤ 24 px con extremo de datos redondeado (4 px) y base cuadrada, sobre una sola línea base en 0 (admite meses con pérdida).
- Cuadrícula y ejes discretos.
- Tooltip con cursor **y teclado**, con zona activa más grande que la barra.
- La **tabla** de al lado es la vista accesible de los mismos datos.

**Por qué "ahora" viene del servidor:** con Cache Components, el rango "últimos N días" usa la hora **de la petición**, que pasa el servidor con `connection()` dentro de `<Suspense>`, y no la hora del build.

## Desempeño del dispatcher con IA

`GET /v1/reports/ai` toma las negociaciones creadas en el periodo:

| Métrica | Cálculo |
|---|---|
| Tasa de cierre | Reservadas ÷ terminadas (reservadas + rechazadas + fallidas). Las canceladas por el usuario no cuentan |
| Tarifa prom. sobre la publicada | Promedio de (acordada − publicada) ÷ publicada en las reservadas |
| Ingreso extra conseguido | Σ (acordada − publicada): **cuánto ganó la IA frente a aceptar la tarifa publicada** |
| Rondas prom. | Promedio de rondas enviadas al broker |
| Por estrategia | Lo mismo separado por Claude y reglas, para comparar el LLM contra la línea base determinista |

Las funciones de agregación (`totalsOf`, `groupTrips`, `aiPerformance`, `csvCell`) son puras, viven en `packages/shared/src/reports.ts` y tienen tests.

**Permiso:** `finances:read` (Owner y Fleet Manager). Dispatcher y Driver no ven finanzas.

## Mapa en vivo (`/map` en la web)

- **Datos:** `GET /v1/fleet/live` (`trips:read`) devuelve los viajes activos con su último GPS, ETA y destino, y cada vehículo con su posición: GPS reciente o, si no hay, su base.
- **Mapa:** **MapLibre GL** (código abierto), cargado solo en el navegador. Se actualiza cada 30 s.
- **Estilo del mapa:** `NEXT_PUBLIC_MAP_STYLE_URL` (proveedor de teselas en producción). Por defecto usa las teselas raster de OpenStreetMap oscurecidas, **solo para desarrollo** (política de uso de OSM). Ver [ADR-0017](./adr/0017-web-maps.md).
- **Seguridad:** los popups se construyen con `textContent`, nunca HTML, porque nombres de ciudades o conductores podrían traer marcado (XSS).
- **Driver:** solo ve sus propios viajes y ningún vehículo.
