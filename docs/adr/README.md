# Architecture Decision Records

Cada decisión técnica relevante se documenta aquí (es **obligatorio**; ver [`../conventions.md`](../conventions.md)). Copia [`0000-template.md`](./0000-template.md), usa el siguiente número y agrégalo a esta lista.

| # | Decisión | Estado |
|---|---|---|
| [0001](./0001-monorepo-npm-workspaces-turborepo.md) | Monorepo con npm workspaces y Turborepo | Aceptado |
| [0002](./0002-nestjs-prisma-postgresql.md) | NestJS 11 + Prisma 7 + PostgreSQL/PostGIS | Aceptado |
| [0003](./0003-redux-toolkit-rtk-query.md) | Redux Toolkit + RTK Query compartido | Aceptado |
| [0004](./0004-multi-tenant-rbac.md) | Multi-tenant por organización con RBAC compartido | Aceptado |
| [0005](./0005-load-provider-adapters.md) | Fuentes de cargas con adaptadores | Aceptado |
| [0006](./0006-auth-jwt-refresh-rotation.md) | JWT corto + refresh opaco rotado | Aceptado |
| [0007](./0007-web-bff-session.md) | Web con BFF y cookies httpOnly | Aceptado |
| [0008](./0008-mobile-expo-redux.md) | Mobile con Expo migrada a Redux | Aceptado |
| [0009](./0009-canada-first-defaults.md) | Canadá primero, moneda y unidades como datos | Aceptado |
| [0010](./0010-design-tokens-single-source.md) | Tokens de diseño como fuente única (colores y fuentes) | Aceptado |
| [0011](./0011-i18n-shared-catalogs.md) | i18n con catálogos ICU compartidos y errores por código | Aceptado |
| [0012](./0012-matching-and-geo.md) | Match determinista, PostGIS por trigger y deadhead aproximado | Aceptado |
| [0013](./0013-ai-agent-architecture.md) | Agente de negociación como workflow con Policy Engine determinista | Aceptado |
| [0014](./0014-jobs-and-push.md) | BullMQ para el workflow y Expo Push HTTP API | Aceptado |
| [0015](./0015-document-storage.md) | Documentos en S3 con URLs firmadas (SeaweedFS local) | Aceptado |
| [0016](./0016-trip-tracking.md) | Seguimiento de viajes en primer plano primero | Aceptado |
| [0017](./0017-web-maps.md) | MapLibre GL con estilo configurable para el mapa web | Aceptado |
| [0018](./0018-team-invitations.md) | Invitaciones por enlace, una organización por usuario, alcance del conductor | Aceptado |
