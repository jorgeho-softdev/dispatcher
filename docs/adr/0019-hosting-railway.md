# ADR-0019: Hosting en Railway con imágenes Docker del monorepo

- **Estado:** Aceptado
- **Fecha:** 2026-11-18

## Contexto
Para la beta en TestFlight la app necesita una API pública con HTTPS. La API necesita procesos que sigan corriendo (la cola BullMQ de la IA), Postgres con PostGIS y Redis. El presupuesto inicial es bajo y no hay nadie dedicado a operar servidores.

## Decisión
- **Railway** para todo: `web`, `api`, PostGIS y Redis en un solo proyecto, con red privada entre servicios. Los archivos van a **Cloudflare R2** (compatible con S3, sin costo de salida).
- **Imágenes Docker** construidas desde la raíz del repo (necesitan `packages/*`), con un Dockerfile por app. Cada imagen instala **solo los workspaces que usa** (`npm ci -w …`): la imagen de la API no trae Expo ni Next.
- **Web en modo `standalone`** (`outputFileTracingRoot` en la raíz del monorepo).
- **Migraciones en el pre-deploy** (`npm run release`): si fallan, la versión nueva no recibe tráfico.
- **Configuración como código** (`apps/*/railway.json`) con `watchPatterns`, para que un cambio en la web no redepliegue la API.
- **Marketplace simulado en la beta**, solo con `SIMULATED_MARKETPLACE=true`. Al refrescar nunca toca cargas en negociación ni reservadas. El usuario demo jamás se crea en producción.
- **Producción estricta:** la API no arranca con URLs `localhost` o sin HTTPS en `WEB_URL`/`CORS_ORIGINS`.

## Alternativas consideradas
- **Vercel (web) + Railway (backend):** Vercel es lo más simple para Next, pero su plan gratis no permite uso comercial y suma un proveedor más. Mover la web a Vercel después es fácil: solo necesita `API_URL`.
- **VPS (Hostinger KVM, Oracle Always Free):** más barato o gratis, pero hay que operar el servidor (actualizaciones, respaldos, HTTPS). El plan Premium Web Hosting de Hostinger es hosting compartido y no puede correr Docker, PostGIS ni Redis.
- **Render (plan gratis):** la API se duerme sin tráfico, y la cola de la IA necesita estar despierta.
- **Imagen única con API + web:** más barata, pero acopla despliegues y escalado.

## Consecuencias
- Costo estimado de US$10–20/mes en la beta, que crece con el uso (Railway cobra por recursos).
- La imagen de la API (~1 GB) incluye las dependencias de desarrollo, porque el pre-deploy usa `prisma` y `tsx`. Se puede reducir más adelante compilando el script del marketplace.
- Hay que configurar un proveedor de teselas de mapa antes del lanzamiento público (las de OSM son solo para pruebas).
- Detrás de un proxy, `request.url` es la dirección interna. El chequeo de origen del BFF usa los encabezados `x-forwarded-*`.
