# ADR-0016: Seguimiento de viajes en primer plano primero, segundo plano después

- **Estado:** Aceptado
- **Fecha:** 2026-11-15

## Contexto
La pantalla del viaje muestra la ETA y los km restantes (mockup: "ETA 1:52 PM · Restante 180 km"). El seguimiento continuo en segundo plano consume batería, exige el permiso "Siempre", pasa por una revisión estricta de Apple y Google, y es información sensible (privacidad del conductor).

## Decisión
- **Fase 3: rastreo en primer plano** mientras la pantalla del viaje está abierta.
  - `expo-location`, con `watchPositionAsync` en precisión balanceada, cada 200 m o 30 s.
  - Los puntos se envían por lotes: el primero de inmediato, luego cada 60 s o cada 10 puntos, y al salir de la pantalla.
- **Rastreo en segundo plano:** queda como siguiente iteración, con `expo-task-manager`, permiso "Siempre", una pantalla de consentimiento propia y su configuración nativa.
- **La API calcula la ETA** con la misma aproximación que el deadhead (haversine × 1.25), usando la velocidad observada si es plausible o 75 km/h.
- **La última posición también actualiza el vehículo**, así el match de cargas usa el GPS reciente.
- **Mapa:** `react-native-maps` (Apple Maps en iOS; Google Maps con clave en Android) con una línea recta. "Navegar" delega en la app de mapas del teléfono.

## Alternativas consideradas
- **Segundo plano desde ya:** mayor complejidad, más riesgo de rechazo en las tiendas y más fricción de permisos antes de validar el producto.
- **Proveedor de rutas (Mapbox/Google Directions)** para la ETA y la geometría real: es más preciso, pero agrega costo por consulta. Se integrará junto con la API de rutas para el deadhead.
- **WebSockets** para la posición en vivo en la web: la web consulta cada 30 s. Llegará con el mapa en vivo de la Fase 4.

## Consecuencias
- La ETA se actualiza solo cuando el conductor abre la app durante el viaje. Es suficiente para el MVP y respeta batería y privacidad.
- `trip_locations` crecerá con el tiempo: más adelante habrá que particionarla por fecha o definir retención.
