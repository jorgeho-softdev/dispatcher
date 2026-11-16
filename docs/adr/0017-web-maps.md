# ADR-0017: MapLibre GL con estilo configurable para el mapa web

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto
La web necesita un mapa en vivo de viajes y vehículos. La app usa `react-native-maps` (Apple Maps / Google Maps), pero en la web no queremos atarnos a la API de pago de Google ni a un proveedor de teselas desde el día 1.

## Decisión
- **MapLibre GL JS** (`maplibre-gl@6.16.0`, versión fija): fork abierto de Mapbox GL, soporta vectores y raster y no tiene licencia por carga.
- **Estilo inyectable** con `NEXT_PUBLIC_MAP_STYLE_URL`. En producción será un estilo vectorial de un proveedor (MapTiler, Stadia, Protomaps autohospedado).
- **Por defecto (desarrollo):** teselas raster de OpenStreetMap con atribución, invertidas y desaturadas para el tema oscuro.
- **Solo en el navegador:** se carga con `import()` dentro de `useEffect`, nunca durante el prerender.
- **Popups con `textContent`**, nunca HTML de datos.
- **Marcadores** con los colores de los tokens de diseño.

## Alternativas consideradas
- **Google Maps JS API:** costo por carga y clave expuesta en el cliente.
- **Leaflet:** más simple, pero sin vectores ni rotación, y su ecosistema es menos activo para estilos modernos.
- **Mapbox GL JS v2+:** licencia propietaria con cobro por carga.

## Consecuencias
- Las teselas públicas de OSM **no se deben usar en producción** (la política de uso lo prohíbe con tráfico real). Hay que configurar un proveedor antes del lanzamiento.
- El mismo componente servirá para trazar rutas reales cuando se integre un proveedor de rutas.
