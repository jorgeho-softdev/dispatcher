# ADR-0001: Monorepo con npm workspaces y Turborepo

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
La API, la web admin y la app móvil comparten el mismo dominio: cargas, viajes, negociaciones, permisos y cálculo de ganancia. El equipo es pequeño y el modelo de datos va a cambiar mucho durante la validación en Canadá.

## Decisión
- Un solo repositorio, con `apps/` (api, web, mobile) y `packages/` (shared, api-client, design-tokens, tsconfig).
- **npm workspaces** como gestor de paquetes y **Turborepo** para orquestar y cachear las tareas.

## Alternativas consideradas
- **Un repositorio por app:** cada cambio de contrato exige publicar un paquete npm privado y coordinar varios PRs, con riesgo de que alguna app quede desincronizada. Tendría sentido con equipos separados o accesos restringidos.
- **pnpm:** React Native exige `node-linker=hoisted`, lo que anula su principal ventaja. Además, corepack falla en el Node local (claves de firma desactualizadas). npm viene con Node y Expo lo soporta de forma nativa.

## Consecuencias
- Un cambio de contrato es un solo commit verificado por TypeScript en las tres apps.
- Cada app se despliega por separado: API en su servidor, web en Vercel, mobile con EAS.
- Hay que mantener **una sola versión de React** (19.2.3, la que fija Expo SDK 57) en web y mobile para evitar copias duplicadas.
- Separar una app a su propio repo más adelante es sencillo.
