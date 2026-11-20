# Convenciones y buenas prácticas (OBLIGATORIAS)

Estas reglas son **mandatorias** para todo el código del monorepo, escrito por personas o por agentes de IA. Un PR que las incumpla no se integra. Si una regla estorba, se cambia con un ADR, no se ignora.

## 0. Definition of Done

Un cambio está terminado solo si cumple todo esto:

- [ ] `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` pasan en la raíz.
- [ ] Hay tests para la lógica nueva: reglas de negocio, guards, cálculos y proveedores.
- [ ] La **documentación está actualizada en el mismo cambio**:
  - `docs/architecture.md` si cambia la estructura, un flujo o un endpoint.
  - Un **ADR nuevo** en `docs/adr/` por cada decisión técnica relevante: librería, patrón, trade-off.
  - El README de la app afectada.
  - El `CHANGELOG.md` de mobile si cambia la app.
- [ ] Ningún secreto en el código ni en git (`.env` está ignorado; solo `.env.example`).
- [ ] Cualquier cambio de esquema tiene su migración de Prisma.

## 1. Generales

- **TypeScript estricto** en todo el repo. Prohibido `any`: usa `unknown` y estrecha el tipo.
- **Fuente única de verdad.** Enums, esquemas de validación, DTOs, permisos y cálculos de negocio viven en `@dispatcher/shared` y nunca se duplican en una app. Para agregar un valor (p. ej. un tipo de equipo): primero `shared/constants.ts`, luego el enum de Prisma con su migración, y por último las etiquetas de UI.
- **La validación usa los mismos esquemas Zod en cliente y servidor.** El cliente valida por UX; la API valida por seguridad.
- **Nombres:**
  - Archivos de componentes React en `PascalCase.tsx`; el resto en `kebab-case.ts`.
  - Tipos en `PascalCase` y constantes en `UPPER_SNAKE_CASE`.
- **Comentarios en inglés** en el código; la documentación (`docs/`) en español.
  - Explican el **porqué**, no el qué.
- **Dependencias:**
  - Antes de agregar una, revisa si una existente ya lo resuelve.
  - Los paquetes del SDK de Expo se instalan con `npx expo install`.
- **Formato** con Prettier y lint con ESLint, sin desactivar reglas salvo con un comentario que explique el motivo.

## 2. Arquitectura del monorepo

- Dirección de dependencias: `apps → packages`, nunca al revés. `shared` no importa frameworks.
- Una app nunca importa archivos de otra app.
- Todo código que usen dos o más apps va a un paquete de `packages/`.
- Las variables de entorno se validan al arrancar (Zod en la API). Cada app documenta las suyas en `.env.example`.

## 3. API (NestJS)

- **Endpoints públicos con credenciales** (registro, login, aceptar invitación) llevan `@AuthRateLimit()`. Cuando el BFF los llama, reenvía la IP del navegador con `clientIpHeaders(request)`; si no, todos los usuarios de la web compartirían un mismo límite.
- **Un módulo por dominio** en `src/modules/<dominio>/`, con `*.module.ts`, `*.controller.ts` y `*.service.ts` (y `providers/` si aplica).
- **Controllers delgados:** solo reciben, validan (`ZodValidationPipe`) y delegan. La lógica va en el servicio.
- **Seguridad por defecto:**
  - Todas las rutas requieren JWT; las públicas se marcan explícitamente con `@Public()`.
  - Cada ruta que lee o escribe datos de negocio declara `@RequirePermission(...)`.
- **Tenancy:**
  - Todo método de servicio recibe `organizationId` y lo usa en el `where`.
  - Un recurso ajeno responde **404**.
  - Nunca confíes en un `organizationId` que venga del body.
- **DTOs:** los servicios devuelven tipos de `@dispatcher/shared` mediante una función `toXDto()`. Nunca se expone una entidad de Prisma directamente: hay campos internos como `passwordHash` o `deletedAt`, y los `Decimal` deben pasar a `number`.
- **Errores:**
  - Se lanzan las excepciones de Nest (`NotFoundException`, etc.).
  - Los mensajes no revelan detalles internos.
  - La validación devuelve `{ statusCode, message, issues[] }`.
- **Paginación** por cursor (`cursor` + `limit`, respuesta `Paginated<T>`), no por offset.
- **Versionado:** todo bajo `/v1`. Un cambio incompatible crea `/v2`.
- **Operaciones atómicas:** los flujos de varios pasos usan `prisma.$transaction`. Las carreras se evitan con updates condicionales, como en la rotación del refresh token.

## 4. Base de datos (Prisma + PostgreSQL)

- Los modelos van en `PascalCase` y las tablas y columnas en `snake_case` (`@@map` / `@map`).
- Las PK son `uuid`. Todas las tablas llevan `created_at`, y las que cambian también `updated_at`.
- **Dinero:** `Decimal(12,2)` + columna `currency`; nunca `Float`. **Distancias:** km.
- **Soft delete** (`deleted_at`) en entidades referenciadas por históricos (vehículos, más adelante viajes).
- Se crea un índice para cada filtro frecuente y para cada FK.
- **Migraciones:**
  - Se crean con `npm run db:migrate -- --name <descripcion>` y nunca se editan una vez integradas.
  - En producción se aplican con `npm run db:deploy`.
- El seed es idempotente y **se niega a correr en producción**.
- Lo que Prisma no modela (extensiones, triggers, funciones) va en SQL dentro de la migración, con un comentario que lo explique. Después se verifica que no haya drift con `prisma migrate dev --create-only` (debe salir una migración vacía, que se borra).
- El SQL crudo se escribe **solo** con `Prisma.sql` parametrizado (nunca interpolando strings) y únicamente donde Prisma no alcanza (p. ej. consultas PostGIS).
- Prisma 7 no regenera el cliente al migrar: después de cambiar el esquema, corre `npm run db:generate --workspace=api`.

## 5. Gestión de estado (web y mobile)

- **Datos del servidor → RTK Query** (`@dispatcher/api-client`). Prohibido guardarlos manualmente en slices.
- **Estado del cliente → un slice por dominio**, con `selectors` dentro del slice. Los componentes leen con selectores, no con `state.x.y`.
- **Hooks tipados:** usa siempre `useAppDispatch` y `useAppSelector`.
- **Solo datos serializables en Redux.** Callbacks y objetos de clase van fuera (ver `lib/app-alert.ts` en mobile).
- **Efectos secundarios** en thunks (`createAsyncThunk`) o en el listener middleware, nunca en reducers.
- **Endpoints nuevos:**
  - Se agregan en `packages/api-client` con sus `providesTags` / `invalidatesTags`.
  - Si el recurso es nuevo en web, también va en `ALLOWED_RESOURCES` del BFF.

## 6. Web (Next.js 16)

- **Lee la documentación incluida** en `node_modules/next/dist/docs/` antes de usar una API de Next (esta versión tiene cambios incompatibles; ver `apps/web/AGENTS.md`).
- **Los tokens nunca llegan al navegador:**
  - Toda llamada a la API pasa por el BFF (`/api/backend/*`).
  - El código con secretos importa `'server-only'`.
- **Server Components por defecto.** Usa `'use client'` solo donde haya interactividad o hooks. Con Cache Components, no leas la sesión en layouts ni a nivel de página.
- **`proxy.ts`** es solo una verificación optimista; la autorización real la hace la API.
- **Estilos:**
  - Tailwind con las clases de los tokens (`bg-surface`, `text-primary`…). Nada de colores hex en componentes ni en CSS: los colores y fuentes se cambian **solo** en `packages/design-tokens/src/tokens.ts` (ver `docs/design-system.md`).
  - Las primitivas de UI van en `components/`.
  - Los componentes de dominio van en `features/<dominio>/`.
- **Accesibilidad:** `label` en cada input, `role="alert"` en los errores y `aria-current` en la navegación.

## 7. Mobile (Expo / React Native)

- Sigue `apps/mobile/AGENTS.md`: Expo Router, NativeWind con tokens del tema (sin hex) y textos con `t()`.
- **Navegación por autenticación** con `Stack.Protected`. Nunca se redirige a mano.
- **Secretos:**
  - Van solo en `expo-secure-store`.
  - MMKV es para preferencias no sensibles.
- **Listas:** `FlatList` con `renderItem` memoizado y elementos con `memo`. Pasar a FlashList cuando las listas crezcan.
- **Configuración nativa** solo vía `app.json` + config plugins. `ios/` y `android/` son generados (CNG).

## 7.1 Internacionalización (obligatorio)

Sigue [`docs/i18n.md`](./i18n.md):
- Ningún texto visible escrito a mano: todo pasa por `t()` y las claves van en **todos** los catálogos de `packages/i18n/messages/`.
- Mensajes ICU (sin concatenar frases).
- Fechas, números y dinero con el formato del idioma.
- Errores traducidos por `code`.
- En web, clases lógicas de Tailwind (`ms/me/ps/pe/start/end`) para soportar RTL.
- La API nunca envía texto traducido para el usuario: lanza excepciones con `apiError(code, message)`.

## 8. Seguridad

- **Contraseñas:** argon2.
- **Tokens:** access de vida corta, refresh rotado y hasheado con detección de reuso.
- **Cabeceras y CORS:** `helmet` activo y CORS con lista explícita de orígenes.
- **Validación:** todo input externo pasa por Zod (body, query, env, respuestas de proveedores externos).
- **Datos simulados:** siempre marcados (`isSimulated`, sufijo "(DEMO)") y nunca mezclados sin etiqueta con datos reales.
- **IA:** el LLM solo **propone**. Toda acción con efectos externos pasa por el Policy Engine determinista (`packages/shared/src/negotiation.ts`) y queda auditada en `negotiation_events`. Reservar siempre requiere aprobación humana. El sistema debe funcionar sin LLM (`AI_STRATEGY=rules`) y los tests no deben llamar al LLM.
- **Datos por rol:** el alcance (p. ej. Driver → solo sus viajes) se aplica **en la consulta de la API** con un helper `scope(auth)`, nunca solo en la UI. Lo que está fuera de alcance responde 404.
- **Exportaciones CSV:** siempre con `csvCell` (escape RFC 4180 y neutralización de fórmulas).
- **Contenido de datos en el DOM fuera de React** (mapas, popups): solo con `textContent`, nunca con `innerHTML`.
- **Hora en componentes con Cache Components:** "ahora" se obtiene en el servidor con `connection()` dentro de `<Suspense>`, nunca con `new Date()` durante el prerender.
- **Archivos:** nunca pasan por la API. Se suben y bajan con URLs firmadas de vida corta, la API verifica en S3 (`HEAD`) antes de confiar en una subida, y en la base solo van metadatos (ver ADR-0015).
- **Ubicación del usuario:** solo con permiso explícito y en primer plano mientras no exista un consentimiento específico para el segundo plano (ADR-0016).
- **Jobs:** los handlers de BullMQ son idempotentes (verifican el estado y hacen transiciones atómicas con `updateMany where status = …`). Los efectos secundarios no críticos (push) nunca lanzan excepciones.

## 9. Testing

- **Unit tests** (Jest en la API, `node:test` en `shared`) junto al archivo: `*.spec.ts` / `*.test.ts`.
- **E2E de la API** en `apps/api/test/*.e2e-spec.ts` contra la DB de desarrollo (`npm run test:e2e --workspace=api`).
- Todo bug corregido incluye un test que lo reproduce.

## 10. Git

- Ramas `feat/…`, `fix/…`, `docs/…`, `chore/…` desde `main`.
- Commits en formato [Conventional Commits](https://www.conventionalcommits.org/): `feat(api): …`, `fix(mobile): …`.
- PR pequeños y con CI en verde. El PR enlaza el ADR si toma una decisión de arquitectura.
