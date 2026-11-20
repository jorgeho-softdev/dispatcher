# Privacidad: datos, dónde se guardan y pendientes para la política

Este documento junta los hechos que la **política de privacidad** de HaulGenius debe declarar. No es la política en sí: es el insumo para redactarla, revisarla con un abogado y publicarla. Su URL debe ir en `apps/mobile/lib/urls.ts`; Apple la exige para TestFlight externo y para la App Store.

## Qué datos personales maneja la app

| Dato | De quién | Para qué | Dónde se guarda |
|---|---|---|---|
| Nombre, email, contraseña (hash Argon2), idioma | Miembros de la organización | Cuenta y acceso | Postgres |
| Rol y organización | Miembros | Permisos | Postgres |
| Ubicación GPS (solo con la pantalla del viaje abierta) | Conductores | ETA y seguimiento del viaje | Postgres |
| Documentos de entrega: POD, BOL, recibos (fotos) | Conductores | Prueba de entrega y gastos | Bucket S3 |
| Gastos, tarifas, ganancias | Organización | Reportes financieros | Postgres |
| Token de notificaciones push | Dispositivo del usuario | Avisos de la IA y los viajes | Postgres |
| Historial de negociación | Organización | Auditoría de lo que hizo la IA | Postgres |

Los brokers de la beta son **simulados** (marcados DEMO): no se guardan datos de brokers reales.

## Dónde están los datos (residencia)

**Hoy todo está en Estados Unidos.** Railway no tiene región en Canadá; la región de la base de datos, Redis y el bucket es **US West (California)**. La región del bucket **no se puede cambiar** después de creado (2026-11-18).

- La ley federal canadiense (**PIPEDA**) **permite** guardar datos fuera de Canadá, pero exige:
  - **Avisar** a los usuarios de que sus datos pueden guardarse y procesarse en otro país, y que pueden quedar sujetos a las leyes de ese país.
  - Mantener la **misma protección** mediante contratos con los proveedores.
- **Alberta (PIPA)** exige además informar **qué proveedores fuera de Canadá** usamos y para qué, y a quién contactar con preguntas.
- **BC (PIPA)** tiene reglas similares para el sector privado.

## Proveedores que procesan datos (subprocesadores)

| Proveedor | Qué recibe | País |
|---|---|---|
| Railway (incluye el bucket de documentos) | Base de datos, colas y documentos | EE. UU. (US West) |
| Anthropic (Claude) | Datos de la carga y de la negociación (no los documentos), solo si `AI_STRATEGY` usa Claude | EE. UU. |
| Expo (push) | Token del dispositivo y el texto de la notificación | EE. UU. |
| Apple / Google | Distribución de la app y entrega de notificaciones | EE. UU. |

Si se agrega un proveedor (email, OpenAI, Stripe, load boards), hay que sumarlo a esta tabla y a la política.

## Pendientes para la política de privacidad

- [ ] Declarar que los datos se guardan en **EE. UU.** (Railway, US West) y que pueden estar sujetos a sus leyes.
- [ ] Listar los subprocesadores de la tabla anterior.
- [ ] Explicar el uso de la **ubicación**: solo con el viaje abierto en primer plano; no en segundo plano.
- [ ] Explicar la **retención**: cuánto tiempo se guardan documentos y ubicaciones, y cómo se borran al eliminar la cuenta.
- [ ] Explicar cómo pedir **acceso, corrección o eliminación** de los datos, y un contacto de privacidad.
- [ ] Indicar que la IA **propone** y el humano **aprueba** todo lo que compromete al transportista.
- [ ] Publicar la política y los términos, y poner sus URLs en `apps/mobile/lib/urls.ts` y en la ficha de App Store Connect.
- [ ] Revisarla con un abogado en Canadá antes del lanzamiento público.
- [ ] Más adelante: evaluar mover los datos a un proveedor con región en Canadá si algún cliente lo exige.

Esto no es asesoría legal: es la lista de hechos técnicos que la política debe cubrir.
