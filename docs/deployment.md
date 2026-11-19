# Despliegue en producción (Railway)

HaulGenius corre completo en **Railway**: un proyecto con cinco piezas. Las dos apps se construyen desde este repo con Docker; las bases de datos son servicios administrados. Decisión: [ADR-0019](./adr/0019-hosting-railway.md).

```
Proyecto Railway "haulgenius"
├─ web       Next.js (apps/web/Dockerfile)      → https://app.<dominio>
├─ api       NestJS + cola de la IA (apps/api/Dockerfile) → https://api.<dominio>
├─ PostGIS   Postgres con PostGIS (plantilla)   → solo red privada
├─ Redis     plantilla oficial                  → solo red privada
└─ archivos  Cloudflare R2 (compatible con S3)  → fuera de Railway
```

- La **web** habla con la **API** por la red privada de Railway (`api.railway.internal`); el navegador nunca ve la API ni los tokens.
- La **app móvil** habla con la API por su dominio público (HTTPS).
- Postgres y Redis **no** tienen dominio público.

## Qué hace cada despliegue

| Paso | API | Web |
|---|---|---|
| Build | `apps/api/Dockerfile`: instala solo los workspaces de la API, compila con Turbo, genera Prisma | `apps/web/Dockerfile`: build `standalone` de Next (imagen de ~330 MB) |
| Antes de publicar | `npm run release`: `prisma migrate deploy` + refresco del marketplace **simulado** (si `SIMULATED_MARKETPLACE=true`) | — |
| Healthcheck | `GET /v1/health` (incluye la base de datos) | `GET /en/login` |
| Si falla | Railway no cambia el tráfico a la versión nueva; reinicia hasta 5 veces si se cae | Igual |

La configuración vive en el repo: `apps/api/railway.json` y `apps/web/railway.json`. Cada push a la rama conectada redepliega **solo** el servicio cuyos archivos cambiaron (`watchPatterns`).

## Paso a paso (primera vez)

### 1. Proyecto y bases de datos
1. En Railway: **New → Empty project**. Nómbralo `haulgenius`.
2. **+ Create → Template**, busca **PostGIS** y agrégalo. La plantilla normal de Postgres no trae PostGIS, y la migración `phase1_geo` lo necesita.
3. **+ Create → Database → Redis**.

### 2. Servicio `api`
1. **+ Create → GitHub Repo →** `jorgeho-softdev/dispatcher`. Renombra el servicio a **`api`** (el nombre se usa en las variables de la web).
2. **Settings → Source:** deja el *Root Directory* vacío (la imagen necesita `packages/`). En **Config-as-code** escribe `/apps/api/railway.json`.
3. **Settings → Source → Branch:** `main`.
4. **Variables** (usa el nombre real de tus servicios en `${{…}}`):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | `${{PostGIS.DATABASE_URL}}` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `JWT_ACCESS_SECRET` | 64 caracteres aleatorios: `openssl rand -hex 32` |
   | `WEB_URL` | `https://app.<dominio>` (o el dominio `*.up.railway.app` de la web) |
   | `CORS_ORIGINS` | igual que `WEB_URL` |
   | `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | `haulgenius-documents` |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | token de API de R2 con permiso de lectura y escritura en ese bucket |
   | `AI_STRATEGY` | `rules` (o `auto` + `ANTHROPIC_API_KEY` para usar Claude) |
   | `SIMULATED_MARKETPLACE` | `true` durante la beta (cargas DEMO) |
   | `EXPO_ACCESS_TOKEN` | opcional, para push |

   En producción la API **se niega a arrancar** si `WEB_URL` o `CORS_ORIGINS` apuntan a `localhost` o no son HTTPS.
5. **Settings → Networking → Generate Domain** (o tu dominio: `api.<dominio>`).

### 3. Servicio `web`
1. **+ Create → GitHub Repo →** el mismo repo. Renombra el servicio a **`web`**. Config-as-code: `/apps/web/railway.json`.
2. **Variables:**

   | Variable | Valor |
   |---|---|
   | `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000/v1` |
   | `NEXT_PUBLIC_MAP_STYLE_URL` | estilo de un proveedor de mapas (MapTiler, Stadia…). Sin definir usa OSM, **solo para pruebas** |
3. **Networking → Generate Domain** (o `app.<dominio>`). Vuelve a la API y pon ese dominio en `WEB_URL` y `CORS_ORIGINS`.

### 4. Archivos (Cloudflare R2)
1. En Cloudflare: **R2 → Create bucket** `haulgenius-documents` (ubicación: Norteamérica).
2. **Manage API tokens → Create token** con *Object Read & Write* limitado a ese bucket. Copia el Access Key ID, el Secret y el endpoint S3 a las variables de la API.
3. Crea el bucket antes del primer despliegue: un token limitado a un bucket no puede crearlo.

### 5. Dominio propio (opcional, Hostinger)
En Railway: **Settings → Networking → Custom Domain** en `web` y en `api`. Railway muestra un registro **CNAME** para cada uno; agrégalo en **hPanel → Dominios → DNS**. El HTTPS se emite solo.

### 6. App móvil (TestFlight)
La URL de la API se inyecta en el build con las variables de entorno de EAS (`eas.json` → `environment: production`):

```bash
cd apps/mobile
npx eas-cli env:create --environment production --name EXPO_PUBLIC_API_URL \
  --value https://api.<dominio>/v1 --visibility plaintext
```

Un build de release **no arranca** sin esa variable (`lib/config.ts`).

## Verificar después de desplegar
```bash
curl https://api.<dominio>/v1/health      # {"status":"ok","database":"up"}
curl -I https://app.<dominio>/es/login    # 200
```
Luego crea una cuenta desde la web o la app y comprueba que se vean las cargas DEMO.

## Probar las imágenes en tu Mac
```bash
docker build -f apps/api/Dockerfile -t haulgenius-api .
docker build -f apps/web/Dockerfile -t haulgenius-web .
```
El CI construye las dos imágenes en cada PR (job `docker`).

## Seguridad en producción
- Swagger (`/docs`) está desactivado.
- La API confía en el proxy de Railway (`trust proxy`) para la IP y el protocolo reales.
- El BFF de la web compara el `Origin` del navegador con el host público (`x-forwarded-host`/`x-forwarded-proto`), no con la dirección interna del contenedor. Sin eso, todos los logins darían 403 detrás del proxy.
- Cookies de sesión `Secure`, `HttpOnly`, `SameSite=Lax`.
- El seed de desarrollo (usuario demo) **se niega a correr** en producción. En producción solo se cargan las cargas simuladas, marcadas DEMO, y solo con `SIMULATED_MARKETPLACE=true`.
- Redis se conecta con `family: 0` porque la red privada de Railway es solo IPv6.

## Costos
Estimación por número de usuarios en el documento "HaulGenius: costos y precios". Railway muestra el consumo en vivo en **Usage**; configura un límite de gasto en **Settings → Usage limits**.
