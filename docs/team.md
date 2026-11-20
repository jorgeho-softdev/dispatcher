# Equipo, roles e invitaciones (Fase 4)

Una organización (un owner-operator o una flota pequeña) invita a su gente. Cada rol ve solo lo que necesita.

## Roles

| Rol | Puede |
|---|---|
| **Owner** | Todo. Es el único que puede otorgar o quitar el rol de Owner |
| **Fleet Manager** | Equipo (invitar, cambiar roles, quitar miembros, salvo a Owners), vehículos, cargas, negociaciones, viajes, finanzas y preferencias de la IA |
| **Dispatcher** | Cargas, negociaciones y gestión de viajes. **Sin finanzas** ni equipo |
| **Driver** | Solo **sus** viajes (los asignados a él): progreso, GPS, documentos y gastos. Ve las cargas, pero no reserva, no ve finanzas ni el equipo |

La matriz vive en `packages/shared/src/permissions.ts` (`ROLE_PERMISSIONS`). La API la aplica (`PermissionsGuard`) y los clientes la usan con `can()` para ocultar UI.

**Alcance del conductor:** en `TripsService.scope()`, un Driver solo ve los viajes con `driver_id = él`, en listas, detalle, documentos y mapa. Lo que no ve responde **404**, igual que los recursos de otra organización.

## Reglas (invariantes, con tests e2e)

- **Nadie cambia ni quita su propio acceso** (`CANNOT_CHANGE_SELF`).
- **Siempre queda al menos un Owner** (`LAST_OWNER`).
- **Solo un Owner toca la propiedad:** otorgar Owner, degradar a un Owner o quitarlo (`FORBIDDEN` para los demás).
- **Quitar a un miembro cierra su sesión:** se revocan todos sus refresh tokens. Los access tokens que ya tenga caducan en ≤ 15 min.
- **Cambio de rol:** se aplica en el siguiente refresh del token (≤ 15 min).

## Registro propio

Cualquier persona puede crear su cuenta en la web (`/signup`) o en la app (pantalla "Crear cuenta"). Queda como **Owner** de una organización nueva; el resto del equipo entra por invitación. Los intentos de registro y login tienen un límite por IP. Ver [ADR-0020](./adr/0020-signup-and-auth-rate-limit.md). Login con Google y Apple: pendiente para antes del lanzamiento público.

## Invitaciones por enlace

```
Owner/Fleet Manager ── POST /v1/invitations {email, role} ──► API
                     ◄── { inviteUrl } (se muestra UNA vez; en la DB solo queda el SHA-256 del token)
Invitado abre /<locale>/invite?token=…  ── GET /v1/invitations/preview (público) ──► organización, rol, email
Invitado envía nombre + contraseña ── BFF /api/auth/accept-invite ── POST /v1/invitations/accept ──► cuenta + membresía
                                                                   └─ login ──► cookies de sesión ──► dashboard
```

- **Token:** 32 bytes aleatorios, válido **7 días** y **de un solo uso**. La API lo reclama de forma atómica, así que dos aceptaciones simultáneas no pueden crear dos cuentas.
- **Roles invitables:** Fleet Manager, Dispatcher y Driver. La propiedad nunca se entrega por enlace.
- **Gestión:** las invitaciones pendientes se listan y se pueden revocar.
- **Envío:** **hoy no se envían por email**. El invitador copia el enlace y lo comparte; el email llega en la Fase 5.
- **Una organización por email:** un email ya registrado no se puede invitar (`AUTH_EMAIL_TAKEN`). El soporte multi-organización (cambiar de organización) queda pendiente.
- **Conductores:** la página de invitación les sugiere instalar la app móvil.

## Asignación de conductores

`POST /v1/trips/:id/driver {driverId}` (`trips:manage`) reasigna un viaje activo a cualquier miembro de la organización. Por defecto, el conductor es quien inició la negociación. En la web se cambia desde el detalle del viaje.

## Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/v1/members` | `vehicles:read` (todos los roles) |
| PATCH / DELETE | `/v1/members/:id` | `members:manage` |
| GET / POST / DELETE | `/v1/invitations[/:id]` | `members:manage` |
| GET | `/v1/invitations/preview?token=` | público |
| POST | `/v1/invitations/accept` | público |
| POST | `/v1/trips/:id/driver` | `trips:manage` |

Decisiones: [ADR-0018](./adr/0018-team-invitations.md).
