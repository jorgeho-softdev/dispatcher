# web: AI Dispatcher Admin

Next.js 16 (App Router, Cache Components) + Redux Toolkit / RTK Query + Tailwind 4. La arquitectura está en [`docs/architecture.md#5-web-admin-appsweb`](../../docs/architecture.md) y las decisiones en [ADR-0007](../../docs/adr/0007-web-bff-session.md).

> Esta versión de Next.js tiene cambios incompatibles con versiones anteriores (p. ej. `proxy.ts` reemplaza a `middleware.ts`). Lee `node_modules/next/dist/docs/` antes de usar una API de Next.

## Comandos

```bash
npm run dev        # :3000 (requiere la API en :4000)
npm run build
npm run typecheck  # next typegen + tsc (los tipos de rutas como LayoutProps/RouteContext se generan en .next/types)
npm run lint
```

`apps/web/turbo.json` hace que `build` espere a `typecheck`. Así Turbo no los corre en paralelo, porque ambos escriben `.next/types`.

## Variables de entorno (`.env.local`)

| Variable | Descripción |
|---|---|
| `API_URL` | URL de la API, solo del lado del servidor (default `http://localhost:4000/v1`) |

## Estructura

```
src/app/[locale]/        Todas las páginas, una versión por idioma (/en, /fr, /es, /pa)
  (dashboard)/           Páginas autenticadas: dashboard, loads (vistas + match), loads/new (carga manual),
                         vehicles (base con selector de ciudad), settings (preferencias + autonomía),
                         negotiations (lista + detalle con auditoría de la IA),
                         trips (lista + detalle: progreso, finanzas reales, documentos, gastos)
  login/                 Login
src/i18n/                next-intl: routing, navigation (Link/useRouter con idioma), request, params
src/app/api/             BFF: auth/login, auth/logout, backend/[...path]
src/proxy.ts             Negociación de idioma (next-intl) + redirección optimista sin sesión
src/features/<dominio>/  Componentes cliente por dominio
src/components/ui.tsx    Primitivas del design system
src/lib/server/          Código solo de servidor (cookies, llamadas a la API)
src/lib/store/           Redux store, RTK Query, slices, hooks tipados
```
