# ADR-0007: La web usa un BFF con cookies httpOnly

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
El admin web maneja datos financieros y operativos. Guardar tokens en `localStorage` los expone a cualquier XSS.

## Decisión
- Los Route Handlers de Next.js actúan como BFF:
  - `/api/auth/login` y `/api/auth/logout` gestionan las cookies httpOnly `ad_access` y `ad_refresh` (`SameSite=Lax`, y `Secure` en producción).
  - `/api/backend/[...path]` inyecta el Bearer y, ante un 401, refresca y reintenta una vez.
- Las peticiones mutantes deben venir del mismo `Origin` (CSRF).
- Lista blanca de recursos y validación de segmentos (SSRF).
- `proxy.ts` (antes "middleware" en Next 16) solo hace la redirección optimista a `/login`.
- RTK Query usa `baseUrl: '/api/backend'`.

## Alternativas consideradas
- **Llamar a la API directamente desde el navegador con un token en memoria:** se pierde la sesión al recargar.
- **`rewrites` de Next:** no pueden inyectar el token desde una cookie httpOnly.

## Consecuencias
- Cada recurso nuevo de la API debe agregarse a `ALLOWED_RESOURCES` en el BFF.
- Con `cacheComponents` activo, las páginas se prerenderizan como shells y no leen la sesión en el servidor; los datos del usuario se cargan en el cliente.
