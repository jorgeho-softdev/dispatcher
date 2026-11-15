# ADR-0006: JWT de vida corta + refresh tokens opacos rotados

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
La app móvil necesita sesiones largas (los conductores no deben reloguearse a cada rato) sin aumentar el riesgo si se roba un token.

## Decisión
- **Access token:** JWT HS256 de 15 min, con claims `sub`, `org` y `role`.
- **Refresh token:** 48 bytes aleatorios; en la DB solo se guarda su SHA-256. Expira a los 30 días y se **rota** en cada refresh dentro de una `family`.
- **Detección de reuso:** presentar un refresh token ya revocado revoca toda la familia. El reclamo es atómico con `updateMany where revokedAt IS NULL`.
- **Logout:** revoca la familia.
- **Contraseñas:** argon2id (`@node-rs/argon2`, con binarios precompilados).

## Alternativas consideradas
- **Sesiones en servidor (cookie + tabla de sesiones):** funcionan mal en mobile.
- **JWT de refresh (no opacos):** no se pueden revocar sin una lista negra.
- **Proveedor externo (Clerk/Auth0):** suma costo y dependencia; queda como opción futura si se necesita SSO.

## Consecuencias
- Los clientes deben hacer **un solo refresh a la vez** (single-flight en mobile; en web lo resuelve el BFF por petición).
- Pendiente: un job que limpie periódicamente los refresh tokens vencidos o revocados.
