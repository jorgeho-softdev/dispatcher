# Despliegue en producción (Railway)

HaulGenius corre completo en **Railway**: un proyecto con cinco piezas. Las dos apps se construyen desde este repo con Docker; las bases de datos son servicios administrados. Decisión: [ADR-0019](./adr/0019-hosting-railway.md).

```
Proyecto Railway "haulgenius"
├─ web       Next.js (apps/web/Dockerfile)      → https://app.<dominio>
├─ api       NestJS + cola de la IA (apps/api/Dockerfile) → https://api.<dominio>
├─ PostGIS   Postgres con PostGIS (plantilla)   → solo red privada
├─ Redis     plantilla oficial                  → solo red privada
└─ documents Bucket de Railway (compatible con S3) → privado
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
2. **+ Add → Template**, busca **PostGIS** y elige la de **Railway Templates**. La plantilla normal de Postgres no trae PostGIS, y la migración `phase1_geo` lo necesita.
   - Cambia **Settings → Source Image** de `postgis/postgis:16-master` (compilación de desarrollo) a **`postgis/postgis:16-3.5`** (estable). Mantén la versión mayor (16): el volumen ya está inicializado con ella.
   - **Borra el TCP Proxy** público (Settings → Networking → 🗑️). La API usa la red privada.
3. **+ Add → Database → Redis**. No actives "Add Public Access".
4. **+ Add → Bucket** (`documents`), en la **misma región** que los servicios (US West). La región no se puede cambiar después. Sus credenciales están en la pestaña **Credentials**.

Todo debe estar en el **mismo proyecto**: la red privada no cruza proyectos. Ojo: el botón **"+ New"** de la lista de proyectos crea un proyecto aparte; dentro del proyecto, el botón es **"+ Add"**.

### 2. Servicio `api`
1. **+ Create → GitHub Repo →** `jorgeho-softdev/dispatcher`. Renombra el servicio a **`api`** (el nombre se usa en las variables de la web).
2. **Settings → Source:** deja el *Root Directory* vacío (la imagen necesita `packages/`). Rama `main`. Activa **Wait for CI** (requiere aceptar los permisos actualizados de la GitHub App de Railway; dale acceso **solo** a este repositorio).
3. **Cómo construir.** Lo ideal es **Config-as-code** → `/apps/api/railway.json`. Si no aparece o no se aplica (Railway usa entonces *Railpack* y falla con "Railpack failed to prepare the build"), configúralo a mano:
   - Variable `RAILWAY_DOCKERFILE_PATH` = `apps/api/Dockerfile`
   - **Settings → Deploy → Add pre-deploy step:** `npm run release` (migraciones; sin esto la API arranca con la base vacía)
4. **Variables** (usa el nombre real de tus servicios en `${{…}}`):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | `${{PostGIS.DATABASE_PRIVATE_URL}}`. **No** `DATABASE_URL` de PostGIS: esa usa el proxy público, y sin él queda con host vacío |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `JWT_ACCESS_SECRET` | debe tener **64 caracteres** (`openssl rand -hex 32`); con menos de 32 la API no arranca |
   | `WEB_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` (o tu dominio `https://app.<dominio>`) |
   | `CORS_ORIGINS` | igual que `WEB_URL` |
   | `S3_ENDPOINT` | el **Endpoint URL** de las Credentials del bucket (`https://t3.storageapi.dev`) |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | el **Bucket Name** de las Credentials (lleva un sufijo aleatorio) |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | las llaves de las Credentials del bucket |
   | `S3_FORCE_PATH_STYLE` | `false` (el bucket de Railway usa URLs por subdominio) |
   | `AI_STRATEGY` | `rules` (o `auto` + `ANTHROPIC_API_KEY` para usar Claude) |
   | `SIMULATED_MARKETPLACE` | `true` durante la beta (cargas DEMO) |
   | `EXPO_ACCESS_TOKEN` | opcional, para push |

   En producción la API **se niega a arrancar** si `WEB_URL` o `CORS_ORIGINS` apuntan a `localhost` o no son HTTPS.
5. **Settings → Networking → Generate Domain** (o tu dominio: `api.<dominio>`).

### 3. Servicio `web`
1. **+ Add → GitHub Repository →** el mismo repo. Renombra el servicio a **`web`**. Wait for CI activado. Config-as-code `/apps/web/railway.json`, o si no aplica, la variable `RAILWAY_DOCKERFILE_PATH` = `apps/web/Dockerfile`.
   Crea `web` **antes** de desplegar la API: la API referencia su dominio. Si la API arrancó antes de que existiera, haz **Redeploy** (no *Restart*, que reutiliza las variables viejas).
2. **Variables:**

   | Variable | Valor |
   |---|---|
   | `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000/v1` |
   | `NEXT_PUBLIC_MAP_STYLE_URL` | estilo de un proveedor de mapas (MapTiler, Stadia…). Sin definir usa OSM, **solo para pruebas** |
3. **Networking → Generate Domain** (o `app.<dominio>`). Vuelve a la API y pon ese dominio en `WEB_URL` y `CORS_ORIGINS`.

### 4. Archivos
Se usa el **Bucket de Railway** del paso 1 (privado; los clientes suben y descargan con URLs firmadas de 5 min). Cloudflare R2 sirve igual: solo cambian las variables `S3_*`.

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

## Producción actual (2026-11-19)
- Web: `https://web-production-4932e3d0.up.railway.app`
- API: `https://api-production-dcade756.up.railway.app/v1`

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

## Privacidad
Railway no tiene región en Canadá: la base de datos, Redis y el bucket están en **US West (California)**. Lo que esto implica para la política de privacidad está en [`privacy.md`](./privacy.md).

## Seguridad en producción
- Swagger (`/docs`) está desactivado.
- La API confía en el proxy de Railway (`trust proxy`) para la IP y el protocolo reales.
- El BFF de la web compara el `Origin` del navegador con el host público (`x-forwarded-host`/`x-forwarded-proto`), no con la dirección interna del contenedor. Sin eso, todos los logins darían 403 detrás del proxy.
- Cookies de sesión `Secure`, `HttpOnly`, `SameSite=Lax`.
- El seed de desarrollo (usuario demo) **se niega a correr** en producción. En producción solo se cargan las cargas simuladas, marcadas DEMO, y solo con `SIMULATED_MARKETPLACE=true`.
- Redis se conecta con `family: 0` porque la red privada de Railway es solo IPv6.

## Costos
Estimación por número de usuarios en el documento "HaulGenius: costos y precios". Railway muestra el consumo en vivo en **Usage**; configura un límite de gasto en **Settings → Usage limits**.
