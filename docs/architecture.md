# Arquitectura de AI Dispatcher

> Documento vivo. **Cualquier cambio de arquitectura debe actualizar este archivo en el mismo cambio** y, si es una decisión relevante, agregar un ADR en [`docs/adr/`](./adr/). Ver [`conventions.md`](./conventions.md).

## 1. Visión del producto

AI Dispatcher es un **despachador con IA para owner-operators** (cargo van, Sprinter, box truck) y flotas pequeñas. La IA busca cargas, analiza la rentabilidad, prepara negociaciones con brokers y acompaña cada viaje hasta el cierre financiero. El lanzamiento es **Canadá primero** (Alberta / BC), con la arquitectura lista para EE.UU. ([ADR-0009](./adr/0009-canada-first-defaults.md)).

## 2. Vista general del sistema

```
┌──────────────────────┐     ┌──────────────────────────────┐
│ apps/mobile          │     │ apps/web (admin)             │
│ Expo / React Native  │     │ Next.js 16 (App Router)      │
│ Redux Toolkit + RTKQ │     │ Redux Toolkit + RTK Query    │
│ Bearer token         │     │ BFF: cookies httpOnly        │
└──────────┬───────────┘     └──────────────┬───────────────┘
           │ HTTPS /v1 (JSON)               │ /api/backend/* → /v1
           └──────────────┬─────────────────┘
                 ┌────────▼─────────┐
                 │ apps/api         │
                 │ NestJS 11        │──► Redis (colas BullMQ: workflow de negociación)
                 │ Prisma 7         │──► S3 (documentos de viaje; SeaweedFS en local)
                 └────────┬─────────┘──► Claude API · Expo Push · (Mapas / Load boards: fases siguientes)
                 ┌────────▼─────────┐
                 │ PostgreSQL 17    │
                 │ + PostGIS        │
                 └──────────────────┘
```

## 3. Monorepo

npm workspaces + Turborepo ([ADR-0001](./adr/0001-monorepo-npm-workspaces-turborepo.md)).

```
dispatcher/
├── apps/
│   ├── api/            NestJS REST API (/v1) + Prisma + seed
│   ├── web/            Next.js admin (BFF + RTK Query)
│   └── mobile/         Expo app (Expo Router + NativeWind + Redux)
├── packages/
│   ├── shared/         Dominio: enums, esquemas Zod, DTOs, RBAC, cálculo de ganancia
│   ├── api-client/     Endpoints RTK Query compartidos (web + mobile)
│   ├── i18n/           Idiomas soportados, negociación y catálogos ICU compartidos (ver i18n.md)
│   ├── design-tokens/  Colores, fuentes, radios y espaciados de la marca (fuente única; ver design-system.md)
│   └── tsconfig/       tsconfig base
├── docs/               Arquitectura, convenciones, ADRs
├── docker-compose.yml  Postgres+PostGIS (5440) y Redis (6380) locales
└── turbo.json          Pipeline build/typecheck/lint/test
```

**Regla de dependencias** (de arriba hacia abajo, nunca al revés):

```
apps/*  ──►  packages/api-client  ──►  packages/shared
apps/*  ──►  packages/design-tokens
apps/*  ──►  packages/i18n         (api: lista de idiomas; web/mobile: catálogos)
apps/api ──► packages/shared   (nunca importa api-client)
```

- `packages/shared` no depende de ningún framework (solo `zod`). Es la **fuente única de verdad** del dominio.
- Los paquetes se compilan con `tsup` a CJS + ESM: la API (CommonJS) y los bundlers de Next y Metro (ESM) consumen el mismo build.

## 4. Backend: `apps/api`

### 4.1 Capas

```
HTTP ─► Guards (JwtAuthGuard → PermissionsGuard)
     ─► Pipes (ZodValidationPipe con esquemas de @dispatcher/shared)
     ─► Controller   (delgado: sin lógica de negocio)
     ─► Service      (reglas de negocio, scoping por organización)
     ─► PrismaService (acceso a datos)
     ─► Mapper toDto (entidad Prisma → DTO de @dispatcher/shared)
```

```
src/
├── main.ts                 helmet, CORS, prefijo /v1, Swagger (/docs, fuera de prod)
├── app.module.ts           Config validada, JWT global, guards globales
├── config/env.ts           Esquema Zod del entorno (la API no arranca si falta algo)
├── common/                 auth-context, decorators (@Public, @RequirePermission, @Auth),
│                           guards, ZodValidationPipe
├── prisma/                 PrismaModule global + PrismaService (adapter pg)
├── generated/prisma/       Cliente Prisma generado (gitignored)
└── modules/
    ├── health/             GET /v1/health (liveness + DB)
    ├── auth/               register, login, refresh, logout, me
    ├── vehicles/           CRUD con soft delete + reporte de GPS
    ├── ai-settings/        Preferencias del transportista
    ├── negotiations/       Agente de IA: máquina de estados, estrategias (Claude/reglas),
    │                       broker simulado, worker BullMQ (ver ai-agent.md)
    ├── notifications/      Tokens de dispositivo + Expo Push (textos i18n)
    ├── storage/            S3 (URLs firmadas; SeaweedFS en local)
    ├── trips/              Viajes: ciclo de vida, GPS/ETA, documentos, gastos, Rate Confirmation PDF
    └── loads/              vistas (recommended/nearby/all), detalle, alta manual
        ├── matching-context.service.ts  vehículo + posición + preferencias (reutilizable por el agente)
        └── providers/      LoadProvider (contrato) + SimulatedLoadProvider
```

### 4.2 Endpoints (Fase 0)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/v1/health` | público | Estado de la API y la DB |
| POST | `/v1/auth/register` | público | Crea usuario + organización (owner) + ajustes IA |
| POST | `/v1/auth/login` | público | Devuelve access + refresh + `me` |
| POST | `/v1/auth/refresh` | público | Rota el refresh token |
| POST | `/v1/auth/logout` | público | Revoca la familia del refresh token |
| GET | `/v1/me` | autenticado | Usuario (con `locale`), organización y rol |
| PATCH | `/v1/me` | autenticado | Cambia el idioma preferido (`{ locale }`) |
| GET | `/v1/vehicles` | `vehicles:read` | Vehículos de la organización |
| POST/PATCH/DELETE | `/v1/vehicles[/:id]` | `vehicles:manage` | Alta / edición / baja lógica. La base (`homeBaseCity/Province`) se geolocaliza con el catálogo de ciudades |
| POST | `/v1/vehicles/:id/location` | `vehicles:report_location` | Último GPS del vehículo (app del conductor) |
| GET | `/v1/loads` | `loads:read` | `view=recommended\|nearby\|all`, match %, deadhead, ganancia; `vehicleId`, `lat/lng`, `radiusKm`, filtros; cursor opaco. Ver [`matching.md`](./matching.md) |
| GET | `/v1/loads/:id` | `loads:read` | Detalle con match, razones y desglose de ganancia |
| POST | `/v1/loads` | `loads:create` | Carga manual (privada de la organización); coordenadas y distancia se resuelven desde el catálogo de ciudades |
| GET | `/v1/ai-settings` | `loads:read` | Preferencias del transportista (match y, en la Fase 2, límites de la IA) |
| PATCH | `/v1/ai-settings` | `ai_settings:manage` | Editar preferencias y autonomía |
| POST | `/v1/negotiations` | `loads:book` | Inicia una negociación con IA (asíncrona). Ver [`ai-agent.md`](./ai-agent.md) |
| GET | `/v1/negotiations[/:id]` | `loads:read` | Lista (`filter=active\|needs_approval\|all`) y detalle con auditoría |
| POST | `/v1/negotiations/:id/{approve-send,adjust,approve-booking,cancel}` | `loads:book` | Acciones humanas del flujo |
| POST/DELETE | `/v1/devices` | autenticado | Token de Expo Push del teléfono |
| GET | `/v1/trips[/:id]` | `trips:read` | Viajes (`filter=active\|completed\|all`) y detalle con documentos, gastos y finanzas. Ver [`trips.md`](./trips.md) |
| POST | `/v1/trips/:id/{status,locations,documents/upload-url,documents/:docId/complete,expenses}` | `trips:progress` | Progreso del conductor, GPS, documentos (URL firmada) y gastos |
| POST | `/v1/trips/:id/{complete,cancel,broker-rating}` | `trips:manage` | Cierre (requiere POD), cancelación y calificación del broker |
| GET | `/v1/documents/:id/download-url` | `trips:read` | URL firmada de descarga (5 min) |

La documentación OpenAPI interactiva está en `http://localhost:4000/docs`.

### 4.2.1 Errores
Todas las respuestas de error tienen la forma `ApiErrorDto { statusCode, code, message, issues? }`, normalizada por `HttpExceptionFilter` (global). `code` es estable (`ERROR_CODES` en `@dispatcher/shared`) y los clientes lo traducen. `message` es solo para desarrolladores. Los servicios lanzan las excepciones de Nest con `apiError(code, message)`.

### 4.3 Multi-tenant y RBAC ([ADR-0004](./adr/0004-multi-tenant-rbac.md))

- Toda tabla de negocio lleva `organization_id`. Un owner-operator es una organización con un miembro.
- El access token incluye `sub` (usuario), `org` (organización) y `role`. Los servicios **siempre** filtran por `auth.organizationId`.
- Un recurso de otra organización responde **404** (no 403), para no revelar que existe.
- La matriz de permisos `ROLE_PERMISSIONS` vive en `@dispatcher/shared`. La API la aplica con `PermissionsGuard` y los clientes la usan con `can()` para ocultar UI.

### 4.4 Autenticación ([ADR-0006](./adr/0006-auth-jwt-refresh-rotation.md))

- **Access token:** JWT HS256 de 15 min.
- **Refresh token:** opaco, de 48 bytes aleatorios. En la DB solo se guarda su **SHA-256**. Dura 30 días y **se rota en cada uso**.
- **Detección de robo:** reutilizar un refresh token ya rotado revoca **toda su familia**. El reclamo es atómico (`updateMany … where revokedAt IS NULL`), así que dos refresh concurrentes no pueden ganar ambos.
- **Contraseñas:** argon2 (`@node-rs/argon2`). Un correo desconocido y una contraseña incorrecta devuelven el mismo error, para evitar la enumeración de cuentas.

### 4.5 Modelo de datos (Fase 0)

```
organizations 1─┬─< memberships >─1 users 1─< refresh_tokens, device_tokens
                ├─< negotiations >─1 loads, vehicles · negotiations 1─< negotiation_events
                ├─< trips (1─1 negotiation) ─< trip_locations, trip_documents, trip_expenses · trips 1─1 broker_ratings
                ├─< vehicles
                ├─< loads (manuales)        loads (marketplace: organization_id NULL)
                └─1 ai_settings             loads >─1 brokers
```

- **Geografía:** `loads.origin_geo` (PostGIS, índice GiST) se mantiene con un trigger desde `origin_lat/lng`. Los vehículos tienen base (`home_base_lat/lng`) y último GPS (`last_lat/lng/location_at`). `ai_settings` incluye las provincias preferidas y las que se evitan. Ver [ADR-0012](./adr/0012-matching-and-geo.md).
- Las cargas del marketplace son globales (`organization_id NULL`) y las manuales pertenecen a una organización.
- `is_simulated` es obligatorio: las cargas simuladas **nunca** se presentan como reales. La API siempre lo devuelve, la web muestra el badge "Demo" y los brokers simulados llevan el sufijo "(DEMO)".
- El dinero se guarda en `Decimal(12,2)` + `currency` (CAD/USD) y las distancias en km. La conversión a mi es solo de presentación.

### 4.6 Proveedores de cargas ([ADR-0005](./adr/0005-load-provider-adapters.md))

`LoadProvider` es el contrato común (`search(criteria) → NormalizedLoad[]`). Hoy existen `SimulatedLoadProvider` (rutas reales de AB/BC/SK con un PRNG determinista) y la carga manual. Loadlink, DAT, Truckstop y 123Loadboard serán nuevos adaptadores, sin tocar el resto del sistema.

### 4.7 Ganancia estimada y match

`estimateProfit()` y `scoreMatch()` en `@dispatcher/shared` son **deterministas** y tienen tests. La ganancia descuenta los km con carga y los km vacíos (deadhead = haversine × 1.25) al costo/km del vehículo. El match (0–100) combina margen, tarifa/km, deadhead, recogida y región, con razones traducibles. La IA razona sobre estos números, pero nunca los inventa. Detalle en [`matching.md`](./matching.md).

## 5. Web admin: `apps/web` ([ADR-0007](./adr/0007-web-bff-session.md))

```
Navegador ──(cookies httpOnly)──► Next.js
   │                               ├─ proxy.ts             redirección optimista sin sesión → /login
   │                               ├─ /api/auth/login      llama a /v1/auth/login y fija las cookies
   │                               ├─ /api/auth/logout     revoca en la API y borra las cookies
   │                               └─ /api/backend/[...]   inyecta el Bearer, refresca si hay 401 (1 reintento)
   └─ RTK Query (baseUrl /api/backend)
```

- **Los tokens nunca llegan a JavaScript del navegador** (protección contra XSS).
- **CSRF:** cookies `SameSite=Lax` y, además, el BFF exige un `Origin` del mismo sitio en las peticiones mutantes.
- **Resiliencia:** si la API no responde (caída o conexión rechazada), `callApi` devuelve **503** `{ message: 'API unavailable' }` en lugar de lanzar una excepción, y la UI muestra "servidor no disponible".
- **Protección SSRF:** el BFF solo reenvía a una lista blanca de recursos (`me`, `loads`, `vehicles`) con segmentos validados por regex.
- **Cache Components** está activo: los layouts y páginas son shells estáticos sin lectura de sesión y los datos del usuario se cargan en el cliente con RTK Query.
- **Store por petición:** `makeStore()` se usa dentro de `StoreProvider` (patrón oficial de Redux para App Router), nunca como singleton.

```
src/
├── app/                (dashboard)/ page, loads/, vehicles/ · login/ · api/ (BFF)
├── proxy.ts            Protección optimista de rutas
├── features/           auth, dashboard, loads, vehicles, shell (componentes por dominio)
├── components/ui.tsx   Primitivas del design system
└── lib/
    ├── server/session.ts   (server-only) cookies, origen, llamadas a la API
    └── store/              store, api (RTK Query), ui-slice, hooks tipados
```

## 5.1 Idiomas
La web y la app comparten idiomas y catálogos (`packages/i18n`). Las URLs de la web son `/<locale>/…` (en, fr, es, pa) y se prerenderizan por idioma. Detalle en [`i18n.md`](./i18n.md) y [ADR-0011](./adr/0011-i18n-shared-catalogs.md).

## 6. App móvil: `apps/mobile` ([ADR-0008](./adr/0008-mobile-expo-redux.md))

```
app/_layout.tsx
  Provider(store) → bootstrapSession() (refresh token del Keychain)
  Splash hasta: fuentes cargadas + estado de auth conocido
  Stack.Protected guard=signedIn   → (tabs) [Inicio, Cargas, Cuenta], settings
  Stack.Protected guard=!signedIn  → login
```

- **Estado:** Redux Toolkit.
  - Slices `settings` (persistido en MMKV de forma síncrona), `alert` y `auth`.
  - `dispatcherApi` (RTK Query compartido) para los datos del servidor.
- **Tokens:** el access token vive solo en memoria (Redux). El refresh token vive en `expo-secure-store` (Keychain/Keystore) y nunca en MMKV ni AsyncStorage.
- **Re-autenticación single-flight:** muchos 401 simultáneos disparan **un solo** refresh. Varios refresh en paralelo activarían la detección de reuso de la API.
- **Logout:** borra el Keychain, hace `resetApiState()` (para no dejar datos del usuario anterior) y revoca en el servidor.
- **API_URL:**
  - `EXPO_PUBLIC_API_URL` por entorno.
  - En desarrollo usa el host de Metro para que un dispositivo físico llegue a la API local.

## 7. Estado por fases

| Fase | Alcance | Estado |
|---|---|---|
| 0. Fundaciones | Monorepo, organizaciones/RBAC, auth, vehículos, cargas simuladas, design system, CI | ✅ |
| 1. Cargas | PostGIS ("cerca de mí"), deadhead, match %, vistas, detalle de carga en mobile, preferencias y cargas manuales en web | ✅ |
| 2. Agente IA (modo asistido) | Orchestrator + Policy Engine, negociaciones, aprobaciones con push, BullMQ | ✅ |
| 3. Viajes | Estados, GPS, ETA, documentos/POD (S3), gastos, ganancia real | ✅ (rastreo en segundo plano: siguiente iteración) |
| 4. Web completa | Flota, reportes, configuración y auditoría de la IA | ⏳ |
| 5. Integraciones | Load boards autorizados, canal de email, modo semiautomático | ⏳ |

Agente de IA (Fase 2): un **workflow** orquestado por código (máquina de estados + BullMQ). Claude propone montos y explicaciones con salida estructurada, y un **Policy Engine determinista** aplica los límites de `ai_settings` y el nivel de autonomía antes de cualquier acción externa. Todo queda auditado en `negotiation_events`. Detalle en [`ai-agent.md`](./ai-agent.md) y [ADR-0013](./adr/0013-ai-agent-architecture.md).
