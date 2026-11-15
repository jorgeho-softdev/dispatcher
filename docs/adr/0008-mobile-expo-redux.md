# ADR-0008: App móvil con Expo (expo-kickstart) migrada a Redux

- **Estado:** Aceptado
- **Fecha:** 2026-11-13

## Contexto
La app debe ser React Native para iOS y Android, con Redux y TypeScript. Existe la plantilla interna `expo-kickstart`: Expo Router, NativeWind con temas en runtime, i18n tipado, appAlert, notificaciones y perfiles de EAS.

## Decisión
- Generar la app con `expo-kickstart` (Expo SDK 57, sin RevenueCat) y **reemplazar Zustand por Redux Toolkit**:
  - Slice `settings`: se persiste en MMKV y se carga de forma síncrona como estado inicial, sin paso de hidratación.
  - Slice `alert`: solo datos serializables; los callbacks quedan fuera de Redux.
  - Slice `auth` y `dispatcherApi` (RTK Query compartido).
- **Tokens:** el refresh token se guarda en `expo-secure-store` (Keychain/Keystore) y el access token solo en memoria.
- **Rutas:** `Stack.Protected` de Expo Router controla el acceso según la sesión.
- **Re-autenticación** con refresh single-flight.

## Alternativas consideradas
- **React Native CLI sin Expo:** más configuración nativa manual y sin CNG ni actualizaciones OTA.
- **Mantener Zustand:** contradice el estándar Redux y no comparte la capa de datos con la web.

## Consecuencias
- Necesita un dev build (Expo Go no soporta MMKV): `npm run ios` / `npm run android`.
- El mensaje `EBADENGINE` de Metro pide Node ≥ 22.13: se recomienda Node 22 LTS reciente (ver `.nvmrc`).
- En producción hay que definir `EXPO_PUBLIC_API_URL`; la app se niega a arrancar sin ella.
