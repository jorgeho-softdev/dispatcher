# ADR-0020: Registro propio y límite de intentos en la autenticación

- **Estado:** Aceptado
- **Fecha:** 2026-11-19

## Contexto
Con la app en producción, un transportista nuevo no tenía cómo crear su cuenta: el endpoint `POST /v1/auth/register` existía, pero ninguna pantalla lo usaba, y solo se podía entrar por invitación. Al abrir el registro al público, los endpoints que reciben credenciales quedan expuestos a adivinar contraseñas y a crear cuentas en masa. La API no tenía ningún límite de intentos.

## Decisión
- **Registro con email y contraseña** en la web (`/<locale>/signup`, vía el BFF `/api/auth/register`, con cookies httpOnly) y en la app (pantalla `signup`, refresh token en el Keychain). Quien se registra queda como **owner** de una organización nueva; los demás roles entran por invitación.
- El cliente valida con el mismo `registerSchema` que la API. El idioma de la cuenta es el idioma activo al registrarse.
- **Límite de intentos por IP** con `@nestjs/throttler` solo en los endpoints públicos con credenciales: `auth/register`, `auth/login` e `invitations/accept`. El límite es `AUTH_RATE_LIMIT_PER_MINUTE` (10 por defecto). Al superarlo responde 429 `RATE_LIMITED`, traducido en los 4 idiomas.
- **IP real del usuario:**
  - La API confía en un salto de proxy (`trust proxy`).
  - Las peticiones de la app llegan por el borde de Railway, que añade la IP del cliente.
  - Las de la web llegan desde el servidor de la web, así que el BFF reenvía la IP del navegador en `X-Forwarded-For`. Usa solo la **última** entrada, la que agregó el borde, para que un cliente no pueda falsificarla.

## Alternativas consideradas
- **Login con Google (y Apple):** se hará antes del lanzamiento público. En iOS, ofrecer Google obliga a ofrecer también "Sign in with Apple" (regla 4.8 de la App Store), y ambos requieren dominio propio y política de privacidad publicada.
- **Límite global en toda la API:** castigaría el uso normal de la app (listas, polling) sin ganancia; el riesgo está en los endpoints con credenciales.
- **Verificación de email al registrarse:** requiere un proveedor de email (Fase 5). Hasta entonces, el límite por IP contiene el abuso.

## Consecuencias
- El contador vive en memoria: es correcto con **una réplica** de la API. Antes de escalar a varias réplicas hay que usar un almacenamiento compartido (Redis) para el throttler.
- Los e2e suben el límite (`setup-env.ts`) porque todas sus peticiones salen de la misma IP; `signup.e2e-spec.ts` lo baja para probar el bloqueo.
- Sin verificación de email, alguien podría registrar un email ajeno. Se mitiga al agregar la verificación en la Fase 5.
