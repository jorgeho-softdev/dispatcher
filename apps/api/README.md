# api: AI Dispatcher REST API

NestJS 11 + Prisma 7 + PostgreSQL. La arquitectura está en [`docs/architecture.md#4-backend-appsapi`](../../docs/architecture.md) y las reglas en [`docs/conventions.md`](../../docs/conventions.md).

## Comandos

```bash
npm run dev            # watch en :4000 (prefijo /v1, Swagger en /docs)
npm run build          # compila a dist/
npm run test           # unit tests (Jest)
npm run test:e2e       # e2e contra la DB local (requiere db:up + db:seed)
npm run db:migrate     # nueva migración en dev: npm run db:migrate -- --name <descripcion>
npm run db:deploy      # aplica migraciones (CI/producción)
npm run db:seed        # usuario demo + cargas simuladas (idempotente, nunca en prod)
npm run db:studio      # Prisma Studio
```

## Variables de entorno

Ver [`.env.example`](./.env.example). Se validan con Zod al arrancar (`src/config/env.ts`).

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a Postgres |
| `JWT_ACCESS_SECRET` | Mínimo 32 caracteres; `openssl rand -base64 48` |
| `JWT_ACCESS_TTL_SECONDS` | Vida del access token (900) |
| `REFRESH_TOKEN_TTL_DAYS` | Vida del refresh token (30) |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas |
| `REDIS_URL` | Redis para BullMQ (default `redis://localhost:6380`) |
| `AI_STRATEGY` | `auto` (Claude si hay `ANTHROPIC_API_KEY`), `claude` o `rules` |
| `ANTHROPIC_API_KEY` | Credencial de Claude (opcional; sin ella se usan reglas) |
| `AI_MODEL` / `AI_EFFORT` | Modelo (`claude-opus-5-5`) y esfuerzo (`medium`) |
| `BROKER_SIM_DELAY_MS` | Retardo de respuesta del broker simulado (4000; 0 en tests) |
| `EXPO_ACCESS_TOKEN` | Opcional: solo si Expo Push tiene "enhanced security" |

## Cómo agregar un módulo

1. Crea los esquemas y DTOs en `packages/shared` (y los permisos nuevos en `permissions.ts`).
2. Agrega el modelo a `prisma/schema.prisma` y crea la migración.
3. Crea `src/modules/<dominio>/` con su module, controller (delgado) y service (filtrado por `organizationId`) y una función `toXDto()`.
4. Protege cada ruta con `@RequirePermission(...)` y valida con `ZodValidationPipe`.
5. Agrega los endpoints en `packages/api-client` (y el recurso en `ALLOWED_RESOURCES` del BFF de la web).
6. Escribe los tests y actualiza `docs/architecture.md` (+ un ADR si hubo una decisión relevante).
