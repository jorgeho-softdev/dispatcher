# Solución de problemas (desarrollo local)

## La web muestra "Build Error" o "Error evaluating Node.js code" y no se arregla al recargar

**Síntoma:** `http://localhost:3000` muestra un error de Turbopack que persiste aunque el archivo ya exista. Por ejemplo:

```
Error: Package path ./web-theme.css is exported from package …/@dispatcher/design-tokens,
but no valid target file was found
```

**Causa:** el servidor de desarrollo resolvió un archivo de un paquete del monorepo (p. ej. el CSS generado de `@dispatcher/design-tokens`) en un momento en que no existía. Pasa si se recompilan los paquetes mientras `npm run dev` está corriendo. Turbopack guarda ese fallo en memoria y en su caché en disco (`apps/web/.next`), así que recargar la página no basta.

**Solución:** reiniciar el servidor limpiando la caché de Next.

```bash
# En la terminal de npm run dev: Ctrl+C para detenerlo, y luego:
cd <raíz del repositorio>            # p. ej. ~/Documents/expo/dispatcher
rm -rf apps/web/.next
npm run dev
```

`npm run dev` vuelve a compilar los paquetes compartidos antes de arrancar la API y la web. `apps/web/.next` es solo caché y build: borrarlo es seguro.

**Para evitarlo:** no ejecutes builds de los paquetes (`npm run build`, `turbo run build --force`) mientras `npm run dev` está corriendo. Si necesitas verificar, detén primero el servidor.

## La API no reconoce endpoints nuevos (404 "Cannot GET /v1/…")

**Síntoma:** la API responde en `/v1/health`, pero los endpoints recién agregados devuelven 404.

**Causa:** `nest start --watch` se quedó con una compilación anterior. Pasa si la compilación falló a mitad de una edición, o si cambió `.env` o el cliente de Prisma.

**Solución:** detener `npm run dev` (Ctrl+C) y volver a arrancarlo. Si cambió el esquema de Prisma, antes ejecuta:

```bash
npm run db:generate --workspace=api
```

## La app móvil dice "Cannot find native module 'Expo…'"

**Causa:** se agregó un módulo nativo (ubicación, mapas, cámara…) y el dev build instalado en el simulador es anterior.

**Solución:** regenerar el proyecto nativo y recompilar.

```bash
cd apps/mobile
npx expo prebuild --clean --platform ios   # o --platform android
npm run ios                                # o npm run android
```

## La app muestra "Could not connect to development server" (pantalla roja)

**Causa:** Metro (el servidor que entrega el JavaScript a la app) no está corriendo, o la app quedó apuntando a un puerto viejo (p. ej. `:8083`).

**Solución:** en una terminal aparte:

```bash
cd apps/mobile
npx expo start --dev-client
```

Cuando esté listo, presiona `i`: abre la app conectada al puerto correcto. Si sigue fallando, cierra la app en el simulador y presiona `i` otra vez.

## Cambié el splash, el ícono o el nombre de la app y no se ve el cambio

**Causa:** son configuración **nativa**. El proyecto `ios/` (o `android/`) se generó antes del cambio, y además iOS guarda en caché la pantalla de inicio.

**Solución:**

```bash
cd apps/mobile
npx expo prebuild --clean --platform ios           # regenera ios/ desde app.json
xcrun simctl uninstall booted com.jorgehurtado.aidispatcher   # borra la app y su caché del simulador
npm run ios                                        # compila e instala de nuevo
```

## La app móvil dice "Can't reach the server"

1. Verifica que la API esté corriendo: `curl http://localhost:4000/v1/health` debe responder `{"status":"ok"}`.
2. Si no responde, reinicia `npm run dev` (ver la sección anterior sobre la API).
3. En un **teléfono físico**, el teléfono y la Mac deben estar en la misma red Wi-Fi. Para subir documentos, define `S3_PUBLIC_ENDPOINT=http://<IP-de-tu-Mac>:9000` en `apps/api/.env`.

## Docker no arranca los servicios (`npm run db:up`)

- Abre Docker Desktop y espera a que esté listo.
- Puertos usados: Postgres **5440**, Redis **6380**, S3 **9000**. Si alguno está ocupado, cambia el mapeo en `docker-compose.yml` y la variable correspondiente en `apps/api/.env`.

## La app se recarga sola al navegar la web o al cambiar la API

**Causa:** en un monorepo, Expo hace que Metro vigile todos los workspaces. Next.js escribe en `apps/web/.next` cada vez que compila una página, y Nest escribe en `apps/api/dist` en cada recompilación. Metro veía esos cambios y recargaba la app.

**Solución (ya aplicada):** `apps/mobile/metro.config.js` limita `watchFolders` a `apps/mobile`, `packages/*` y `node_modules`, y bloquea `apps/web`, `apps/api` y `.turbo`. Si la app llegara a importar código de otra app, eso sería un error de arquitectura: el código compartido va en `packages/`.
