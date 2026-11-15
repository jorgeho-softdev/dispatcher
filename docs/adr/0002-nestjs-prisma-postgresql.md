# ADR-0002: NestJS 11 + Prisma 7 + PostgreSQL/PostGIS

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
El backend Node.js necesita estructura modular (auth, cargas, negociación, viajes, IA), inyección de dependencias, guards globales y un ORM con tipos y migraciones. Las búsquedas geográficas ("cerca de mí") requieren PostGIS.

## Decisión
- **NestJS 11** con módulos por dominio.
- **Prisma 7**: generador `prisma-client` con salida en `src/generated/prisma` y `moduleFormat = "cjs"`, adapter `@prisma/adapter-pg` y `prisma.config.ts`.
- **PostgreSQL 17 + PostGIS**, con la imagen local `imresamu/postgis` (multi-arquitectura; la oficial no tiene versión arm64).
- **Zod** para validar, con los esquemas de `@dispatcher/shared` mediante `ZodValidationPipe` en lugar de class-validator.

## Alternativas consideradas
- **Nest CLI 12 / Nest 12:** el CLI falla en Node 22.12 (`ERR_REQUIRE_CYCLE_MODULE`). Nest 11 es estable; se actualizará cuando se suba Node.
- **Drizzle:** más liviano, pero Prisma ofrece mejores migraciones y DX para un equipo pequeño.
- **class-validator:** duplicaría las reglas que ya existen en Zod y que los clientes también usan.

## Consecuencias
- Jest necesita dos ajustes por Prisma 7: `moduleNameMapper` para los imports `.js` y `--experimental-vm-modules` en los e2e.
- Prisma no maneja `geography` de forma nativa. En la Fase 1 se agregarán columnas PostGIS con `Unsupported(...)` y consultas `$queryRaw`.
