# ADR-0004: Multi-tenant por organización con RBAC compartido

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
El MVP está pensado para el owner-operator, pero el producto debe soportar flotas pequeñas con varios conductores y vehículos, con los roles Owner, Fleet Manager, Dispatcher y Driver.

## Decisión
- Todo cuelga de `organizations`; los usuarios se vinculan por `memberships(role)`. Un owner-operator es una organización de un solo miembro.
- El access token lleva `org` y `role`. Los servicios filtran siempre por `organizationId`.
- La matriz `ROLE_PERMISSIONS` y `can()` viven en `@dispatcher/shared`. La API la aplica con `@RequirePermission` + `PermissionsGuard` (global) y los clientes la usan para ocultar UI.
- Un recurso de otra organización responde 404.

## Alternativas consideradas
- **Modelo de un solo usuario ahora, organizaciones después:** obligaría a una migración costosa más adelante.
- **Una base de datos o un schema por tenant:** es excesivo para miles de organizaciones pequeñas.

## Consecuencias
- En la Fase 1+ se agregará **Row-Level Security** en Postgres como segunda barrera.
- Un cambio de rol se refleja cuando expira el access token (15 min) o en el siguiente refresh.
- Cambiar de organización (usuarios con varias membresías) queda pendiente; hoy se usa la membresía más antigua.
