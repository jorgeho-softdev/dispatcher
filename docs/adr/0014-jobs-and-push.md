# ADR-0014: BullMQ para el workflow y Expo Push HTTP API para notificaciones

- **Estado:** Aceptado
- **Fecha:** 2026-11-15

## Contexto
Los pasos de una negociación son asíncronos. El LLM tarda segundos y el broker responde minutos u horas después. La petición HTTP no puede esperar, el trabajo debe sobrevivir a reinicios con reintentos, y el usuario debe enterarse aunque la app esté cerrada.

## Decisión
- **BullMQ sobre Redis** (`@nestjs/bullmq` 11 + `bullmq` 6 + `ioredis`):
  - Una cola `negotiations` con los jobs `ai-propose`, `ai-respond` y `broker-response`, con 3 reintentos y backoff exponencial.
  - Los handlers son **idempotentes**: verifican el estado actual y las transiciones son atómicas.
  - Las respuestas del broker simulado son jobs con `delay`.
- **Push vía Expo Push HTTP API** (`https://exp.host/--/api/v2/push/send`) con `fetch`, desde `PushService`:
  - Los textos salen de los catálogos i18n compartidos (`@dispatcher/i18n/server`) en el idioma del perfil.
  - Los tokens `DeviceNotRegistered` se eliminan.
  - Un error de push **nunca** rompe la negociación.
- **Polling acotado en la app:** cada 2 s solo mientras la IA o el broker trabajan. El push cubre las esperas largas.

## Alternativas consideradas
- **`@nestjs/bullmq` 12:** es solo ESM y apunta a Nest 12, mientras que la API es Nest 11 en CommonJS (Jest no la carga). Se actualizará junto con Nest.
- **`expo-server-sdk` v8:** es solo ESM. Usarlo requería `import()` dinámico en una app CommonJS y configuración especial de Jest. La API HTTP es pequeña, documentada y estable.
- **Vercel Queues / Workflow:** no aplican, porque la API no corre en Vercel.
- **WebSockets para el tiempo real:** se dejan para una fase posterior. Polling + push alcanzan para el MVP con menos infraestructura.

## Consecuencias
- Redis pasa a ser dependencia de la API (ya estaba en `docker-compose`) y también se usa en CI.
- La web y la app ven los cambios con un pequeño retraso (polling) o al instante por push.
- Para producción hay que monitorear los jobs fallidos (queda retención de 5000). Más adelante se puede agregar un panel (Bull Board).
