# AI Dispatcher

iOS + Android app built with Expo, Expo Router, NativeWind and Zustand.

## Getting started

```bash
npm install
npx eas-cli init        # links the EAS project (owner + projectId in app.json)
npm run ios             # builds the dev client and runs it in the simulator
npm run android
```

The app uses native modules (MMKV, RevenueCat) so it runs in a **development
build**, not Expo Go. `npm run ios/android` builds one locally; to build in the
cloud instead: `npm run build:dev`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Metro bundler for an installed dev client |
| `npm run ios` / `android` | Build + run the dev client locally |
| `npm run typecheck` | `tsc --noEmit` — also catches missing translations |
| `npm run doctor` | `expo-doctor` dependency/config check |
| `npm run build:dev` | EAS development build (both platforms) |
| `npm run build:ios` | EAS production build + submit to TestFlight |
| `npm run build:android` | EAS production build + submit to Play (internal) |

## Architecture

```
app/                    Expo Router routes
  _layout.tsx           Root: Redux Provider, session bootstrap, splash gate, Stack.Protected auth guards
  login.tsx             Sign-in (only reachable while signed out)
  (tabs)/               Inicio, Cargas, Cuenta (only reachable while signed in)
  settings.tsx          Theme, language, notifications, legal links, dev tools
features/
  loads/                Load list UI (LoadCard)
components/
  OnboardingScreen.tsx  First-run flow (rendered instead of the navigator)
  ui/                   Reusable themed primitives (Button, Card, Screen, ScreenHeader…)
lib/
  fonts.ts              The only place font files are loaded (Brand-* aliases)
  themes.ts / theme.ts  Theme registry (from @dispatcher/design-tokens) + useTheme()/useColors()
  i18n.ts               Language options, device locale, translatorFor() (catalogs in packages/i18n)
  IntlRoot.tsx          use-intl provider bound to the persisted language
  use-intl-locale.ts    Intl tag for money/number formatting
  app-alert.ts          Themed Alert.alert replacement (callbacks kept outside Redux)
  config.ts             API_URL (EXPO_PUBLIC_API_URL, or Metro host in dev)
  secure-tokens.ts      Refresh token in Keychain/Keystore (expo-secure-store)
  urls.ts               Privacy policy / terms URLs (required by stores)
store/                  Redux Toolkit (see ../../docs/adr/0008-mobile-expo-redux.md)
  index.ts              configureStore + listener that persists settings to MMKV
  api.ts                RTK Query api from @dispatcher/api-client + single-flight re-auth
  session.ts            Thunks: bootstrapSession, signIn, signOut
  auth-slice.ts         Session status, in-memory access token, current user
  settings-slice.ts     Persisted settings + onboarding (sync MMKV preload)
  alert-slice.ts        Serializable state for appAlert()
  hooks.ts              Typed useAppDispatch / useAppSelector
  storage.ts            MMKV helpers (non-sensitive data only)
  store-coordinator.ts  Cross-slice operations
```

### Theming

Colors and fonts come from `packages/design-tokens/src/tokens.ts`, shared
with the web admin — see `../../docs/design-system.md`. `tailwind.config.js`
turns the token tree into classNames backed by CSS variables (`bg-primary` →
`rgb(var(--color-primary))`), and `app/_layout.tsx` applies the active theme's
values with NativeWind's `vars()`, so switching theme in Settings is instant
with no reload. To add a theme, add it to `themes` in `tokens.ts` (same keys)
and register it in `lib/themes.ts`.

### Before shipping

- [ ] Replace the placeholder art in `assets/` (icon 1024×1024, splash, Android adaptive icons)
- [ ] Set real URLs in `lib/urls.ts`
- [ ] `npx eas-cli init`, then add `ascAppId` to `eas.json` → `submit.production.ios`
- [ ] Android submit: add a Google service account key (`eas credentials` / `submit.production.android.serviceAccountKeyPath`)
