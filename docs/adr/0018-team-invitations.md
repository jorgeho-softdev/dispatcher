# ADR-0018: Invitaciones por enlace, una organización por usuario y alcance del conductor

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto
Las flotas pequeñas necesitan sumar despachadores y conductores con permisos distintos. Todavía no hay un proveedor de email (llega en la Fase 5), y el modelo de sesión usa la primera membresía del usuario.

## Decisión
- **Invitación por enlace:** token aleatorio de 32 bytes guardado como **SHA-256**. Se muestra una sola vez, dura 7 días, es de un solo uso (reclamo atómico) y se puede revocar. El invitador comparte el enlace manualmente.
- **Aceptación en la web:** la página pública `/<locale>/invite`, más una ruta BFF que acepta e inicia sesión con cookies httpOnly.
- **Roles invitables:** Fleet Manager, Dispatcher y Driver. La propiedad (Owner) solo se otorga desde el panel, y solo la otorga otro Owner.
- **Invariantes en el servicio:** sin auto-cambios, siempre un Owner, solo Owners tocan la propiedad. Quitar a un miembro revoca sus refresh tokens.
- **Una organización por email** por ahora: invitar un email ya registrado devuelve `AUTH_EMAIL_TAKEN`.
- **Alcance del conductor:** un Driver solo accede a los viajes asignados a él (filtro en la consulta, con 404 fuera de su alcance).

## Alternativas consideradas
- **Enviar las invitaciones por email ya:** requiere proveedor, dominio verificado y plantillas i18n. Se agrega en la Fase 5 sin cambiar el modelo (el enlace es el mismo).
- **Usuarios multi-organización con selector:** requiere elegir organización en el login y en el token. Es necesario para dispatchers que trabajan con varias flotas, pero no para el MVP.
- **Ocultar los viajes ajenos solo en la UI:** no sirve. El filtro va en la API, que es la frontera de seguridad.

## Consecuencias
- Si el enlace se filtra, cualquiera podría usarlo durante 7 días. Por eso es de un solo uso y se puede revocar; el email directo lo mitigará.
- Los cambios de rol tardan hasta 15 min en aplicarse (vida del access token).
