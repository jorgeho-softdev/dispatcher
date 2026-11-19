# HaulGenius: instrucciones para agentes

Monorepo (npm workspaces + Turborepo): `apps/api` (NestJS + Prisma), `apps/web` (Next.js 16), `apps/mobile` (Expo), `packages/*` (shared, api-client, design-tokens).

## Reglas obligatorias

1. **Buenas prácticas de arquitectura siempre.** Lee y sigue [`docs/conventions.md`](./docs/conventions.md) antes de escribir código.
2. **Documenta todo en el mismo cambio:**
   - [`docs/architecture.md`](./docs/architecture.md) si cambia la estructura, un flujo, un endpoint o el modelo de datos.
   - Un ADR nuevo en [`docs/adr/`](./docs/adr/) por cada decisión técnica relevante (con su línea en `docs/adr/README.md`).
   - El README de la app afectada, y `apps/mobile/CHANGELOG.md` si cambia la app.
3. **El dominio vive en `packages/shared`:** enums, esquemas Zod, DTOs, permisos y cálculos. Nunca se duplican en las apps.
4. **Seguridad por defecto:**
   - Toda ruta de la API requiere JWT y un `@RequirePermission`.
   - Todo dato de negocio se filtra por `organizationId`.
   - Nunca hay tokens en el navegador ni en almacenamiento inseguro.
5. **Datos simulados siempre marcados** (`isSimulated`, "(DEMO)").
6. **Multi-idioma:** ningún texto visible escrito a mano. Toda clave nueva va en **todos** los catálogos de `packages/i18n/messages/` (ver `docs/i18n.md`), y la API responde con códigos de error, nunca con texto traducido.
7. Antes de dar algo por terminado, deben pasar `npm run typecheck && npm run lint && npm run test && npm run build`.

## Guías por app

- `apps/web/AGENTS.md`: esta versión de Next.js tiene cambios incompatibles. Lee `node_modules/next/dist/docs/` antes de escribir código.
- `apps/mobile/AGENTS.md`: convenciones de Expo Router, NativeWind, i18n y Redux.
