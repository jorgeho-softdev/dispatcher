# AI Dispatcher

Despachador con IA para owner-operators y flotas pequeñas. Canadá primero.

Monorepo con **API** (NestJS + PostgreSQL), **web admin** (Next.js) y **app móvil** (React Native / Expo), todo en TypeScript y Redux.

| Documento | Para qué |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | Cómo está construido el sistema |
| [`docs/conventions.md`](./docs/conventions.md) | Buenas prácticas **obligatorias** y Definition of Done |
| [`docs/adr/`](./docs/adr/) | Por qué se tomó cada decisión |
| [`docs/design-system.md`](./docs/design-system.md) | Cómo cambiar colores y fuentes (web + app) |
| [`docs/ai-agent.md`](./docs/ai-agent.md) | Cómo negocia la IA: estados, Policy Engine, Claude, push |
| [`docs/matching.md`](./docs/matching.md) | Cómo se calcula el match %, el deadhead y "Cerca de mí" |
| [`docs/i18n.md`](./docs/i18n.md) | Idiomas (en, fr, es, pa): cómo traducir y agregar idiomas |

## Requisitos

- Node **22.13+** (ver `.nvmrc`; `nvm use`)
- Docker Desktop
- Xcode / Android Studio (solo para correr la app móvil)

## Arranque rápido

```bash
npm install                          # instala todo y genera el cliente Prisma
cp apps/api/.env.example apps/api/.env   # ajusta JWT_ACCESS_SECRET (openssl rand -base64 48)
cp apps/web/.env.example apps/web/.env.local
npm run db:up                        # Postgres+PostGIS :5440, Redis :6380 (colas de la IA)
npm run db:migrate                   # aplica las migraciones
npm run db:seed                      # usuario demo + 40 cargas simuladas
npm run dev                          # API :4000 + web :3000
```

- **API:** http://localhost:4000/v1 · **Swagger:** http://localhost:4000/docs
- **Web admin:** http://localhost:3000 (redirige a `/en`, `/fr`, `/es` o `/pa` según tu navegador)
- **Usuario demo:** `demo@aidispatcher.dev` / `Demo1234!`

**App móvil** (requiere dev build; no funciona con Expo Go):

```bash
npm run build --workspace=@dispatcher/shared --workspace=@dispatcher/api-client --workspace=@dispatcher/design-tokens
cd apps/mobile && npm run ios        # o: npm run android
```

En un dispositivo físico, la app usa automáticamente la IP de tu Mac (host de Metro). Para otra API, define `EXPO_PUBLIC_API_URL`.

## Scripts (raíz)

| Script | Qué hace |
|---|---|
| `npm run dev` | API + web en modo watch (compila los paquetes primero) |
| `npm run build` | Build de todo con caché de Turborepo |
| `npm run typecheck` / `lint` / `test` | Verificaciones de calidad de todo el monorepo |
| `npm run db:up` / `db:down` | Levanta o detiene Postgres y Redis |
| `npm run db:migrate` / `db:seed` / `db:studio` | Migraciones, datos demo y Prisma Studio |
| `npm run test:e2e --workspace=api` | E2E de la API contra la DB local |

## Estructura

```
apps/api          NestJS REST API (/v1), Prisma, seed
apps/web          Next.js admin (BFF + RTK Query)
apps/mobile       Expo app (Expo Router, NativeWind, Redux)
packages/shared   Dominio compartido: Zod, DTOs, RBAC, cálculo de ganancia
packages/api-client      Endpoints RTK Query compartidos
packages/i18n            Idiomas y catálogos de traducción compartidos
packages/design-tokens   Tokens de marca
docs/             Arquitectura, convenciones, ADRs
```
