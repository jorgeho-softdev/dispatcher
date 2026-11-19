# HaulGenius

Expo SDK app (iOS + Android) generated with expo-kickstart. Read the
versioned Expo docs for this project's SDK before writing code — APIs change
between SDKs.

## Conventions

- **Routing**: Expo Router in `app/`. Tabs live in `app/(tabs)/`; full-screen
  pages are plain Stack push screens registered in `app/_layout.tsx` (avoid
  modal presentations — native `<Modal>`s can't stack on them reliably).
- **Styling**: NativeWind classNames only (`bg-surface`, `text-ink`,
  `bg-primary`, `text-on-primary`…). Never hardcode hex colors in
  components; when a raw value is needed (icon `color=`, navigator options)
  use `useColors()` from `lib/theme.ts`.
- **Themes & fonts**: colors and fonts come ONLY from
  `packages/design-tokens/src/tokens.ts` (shared with the web; see
  `../../docs/design-system.md`). `lib/themes.ts` adapts them for runtime,
  `tailwind.config.js` for classNames, `app.config.ts` for native colors,
  and `lib/fonts.ts` is the only file that imports font files.
- **State**: Redux Toolkit in `store/` (repo-wide rules in
  `../../docs/conventions.md#5-gestión-de-estado-web-y-mobile`). Server data
  → RTK Query (`store/api.ts`, endpoints defined in `packages/api-client`).
  Client state → one slice per domain with co-located selectors; read it
  with `useAppSelector(selectX)`. Only serializable data in Redux. Persisted
  slices load synchronously from MMKV as initial state and are saved by the
  listener in `store/index.ts`. Slices never import each other;
  cross-slice operations go in `store-coordinator.ts`. Side effects go in
  thunks (`store/session.ts`).
- **Auth**: routes are gated with `Stack.Protected` in `app/_layout.tsx` —
  never navigate manually on sign-in/out. The refresh token lives only in
  `lib/secure-tokens.ts` (expo-secure-store); never put secrets in MMKV.
- **Domain**: enums, Zod schemas, DTOs and money/profit helpers come from
  `@dispatcher/shared` — never redefine them here.
- **Text**: every user-visible string goes through
  `useTranslations()` from `use-intl` (`t('mobile.home.title')`); catalogs
  are shared with the web in `packages/i18n/messages/*.json` (en, fr, es,
  pa). Add keys with the `add-i18n-key` skill — in EVERY language. Format
  dates/numbers with `useFormatter()` and money with
  `formatMoney(…, useIntlLocale())`. Translate api errors by `code`
  (`t(`errors.${code}`)`). See `../../docs/i18n.md`.
- **Alerts**: use `appAlert()` from `lib/app-alert.ts`, not `Alert.alert`.
- **Native folders** (`ios/`, `android/`) are generated (CNG) and
  gitignored. Change native config via `app.json` + config plugins.
- After every change: `npm run typecheck`, add a `CHANGELOG.md` entry
  (see the `changelog-entry` skill), and update `../../docs/` when the change
  affects architecture (mandatory — see `../../AGENTS.md`).
