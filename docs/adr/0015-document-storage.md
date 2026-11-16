# ADR-0015: Documentos en almacenamiento S3 con URLs firmadas

- **Estado:** Aceptado
- **Fecha:** 2026-11-15

## Contexto
Los viajes generan documentos (Rate Confirmation, BOL, POD con foto, recibos). Son archivos de varios MB que se suben desde teléfonos con mala conexión en carretera. La API no debe convertirse en un cuello de botella ni guardar binarios en Postgres.

## Decisión
- **Almacenamiento compatible con S3** (`@aws-sdk/client-s3` v3):
  - En producción: AWS S3 (`ca-central-1`, para residencia de datos en Canadá) o Cloudflare R2.
  - En local y en CI: **SeaweedFS 4.51** (`docker-compose`), con credenciales y la misma API.
- **URLs firmadas:**
  - Subida: PUT de 10 min con `Content-Type` firmado.
  - Descarga: GET de 5 min, con `Content-Disposition` y nombre de archivo sanitizado.
  - **Los bytes nunca pasan por la API.**
- **Subida en dos pasos con verificación:** `upload-url` crea el documento como `pending`, y `complete` hace `HEAD` en S3 (existe y el tamaño es válido) antes de marcarlo `uploaded`. Nunca se confía en el cliente.
- **Restricciones:** tipos MIME en lista blanca (JPEG, PNG, HEIC, PDF), máximo 15 MB y claves con prefijo de organización (`org/<orgId>/…`).
- **`requestChecksumCalculation: 'WHEN_REQUIRED'`:** los checksums por defecto del SDK (desde 2025) agregan `x-amz-checksum-*` a las URLs firmadas, que los teléfonos no envían, y rompen R2, SeaweedFS y MinIO.
- **Dos endpoints:**
  - `S3_ENDPOINT`: lo usa el servidor.
  - `S3_PUBLIC_ENDPOINT`: firma las URLs con un host que el cliente alcanza (un teléfono físico no llega a `localhost`).
- **Bucket:** en desarrollo se crea al arrancar; en producción lo aprovisiona la infraestructura.

## Alternativas consideradas
- **Subir a través de la API (multipart):** duplica el tráfico, ocupa workers y limita el tamaño.
- **Guardar en Postgres (bytea):** infla la base y los backups, y no tiene CDN.
- **MinIO local:** la imagen `minio/minio` dejó de publicarse en Docker Hub (y Quay). SeaweedFS es Apache-2.0, activo y de un solo contenedor.
- **Vercel Blob:** la API no corre en Vercel.

## Consecuencias
- La API escala independientemente del tamaño de los archivos.
- Los objetos `pending` que nunca se confirman quedan huérfanos: falta un job de limpieza (o una regla de ciclo de vida del bucket) en producción.
- Para teléfonos físicos en desarrollo hay que poner `S3_PUBLIC_ENDPOINT=http://<IP-LAN>:9000`.
