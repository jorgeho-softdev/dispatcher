# ADR-0009: Canadá primero, con moneda y unidades como datos

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
El análisis de mercado mostró menos competencia en IA en Canadá (Loadlink no tiene funciones de IA) y un segmento poco atendido de vehículos ligeros. EE.UU. es la expansión natural, porque las rutas son transfronterizas.

## Decisión
- Valores por defecto: `country=CA`, `currency=CAD`, distancias en km, región inicial AB/BC.
- La moneda (`CAD|USD`), el país y las unidades son **datos** desde el día 1: `DEFAULTS` en `@dispatcher/shared` y columnas en la DB.
- El equipo inicial es cargo van, Sprinter y box truck (el modelo admite también dry van, reefer y flatbed).
- Los idiomas iniciales son inglés y español; francés y punjabi vendrán después.

## Consecuencias
- Expandirse a EE.UU. no requiere reescribir: se suman adaptadores (DAT/Truckstop), USD y millas en la presentación.
- Pendiente para los viajes transfronterizos: el eManifest ACI/ACE.
