# ADR-0003: Redux Toolkit + RTK Query compartido en web y mobile

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
El estándar del proyecto es Redux. Web y mobile consumen los mismos endpoints con mecanismos de autenticación distintos: cookies vía BFF en web y bearer token en mobile.

## Decisión
- **Datos del servidor:** RTK Query. `packages/api-client` expone `createDispatcherApi(baseQuery)` con todos los endpoints, tags e invalidaciones, y cada app aporta su `baseQuery`.
- **Estado del cliente:** slices de Redux Toolkit con selectores co-ubicados y hooks tipados.
- **Web:** `makeStore()` por petición.
- **Mobile:** un store único (no hay SSR).

## Alternativas consideradas
- **Zustand** (lo que trae expo-kickstart): más simple, pero rompe el estándar y no comparte la capa de datos con la web.
- **TanStack Query + Redux:** dos sistemas para lo mismo.

## Consecuencias
- Un endpoint nuevo se define una sola vez y ambas apps reciben hooks tipados.
- `@reduxjs/toolkit`, `react` y `react-redux` son peer dependencies de `api-client`, para que haya una sola instancia.
