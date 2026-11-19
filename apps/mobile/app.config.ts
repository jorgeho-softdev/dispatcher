import type { ConfigContext, ExpoConfig } from 'expo/config';
import { themes, defaultTheme } from '@dispatcher/design-tokens';
import { BRAND_NAME } from '@dispatcher/shared';

// Extends app.json with values that must come from the brand tokens
// (packages/design-tokens/src/tokens.ts): native splash background, Android
// adaptive-icon background and notification accent color. Keeps app.json free
// of hardcoded hex values.
const brand = themes[defaultTheme].colors;

type PluginEntry = string | [string, Record<string, unknown>];

function withPluginOptions(plugins: PluginEntry[] = [], name: string, options: Record<string, unknown>): PluginEntry[] {
  return plugins.map((p) => {
    const pluginName = Array.isArray(p) ? p[0] : p;
    if (pluginName !== name) return p;
    const current = Array.isArray(p) ? p[1] : {};
    return [name, { ...current, ...options }];
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  let plugins = config.plugins as PluginEntry[] | undefined;
  plugins = withPluginOptions(plugins, 'expo-splash-screen', { backgroundColor: brand.background });
  plugins = withPluginOptions(plugins, 'expo-notifications', { color: brand.primary.DEFAULT });

  // Android maps need a Google Maps SDK key (iOS uses Apple Maps, no key).
  // Set GOOGLE_MAPS_ANDROID_API_KEY in .env / EAS env; never commit it.
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    name: config.name ?? BRAND_NAME,
    slug: config.slug ?? 'mobile',
    android: {
      ...config.android,
      adaptiveIcon: { ...config.android?.adaptiveIcon, backgroundColor: brand.surface },
      ...(googleMapsApiKey && { config: { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } } }),
    },
    plugins,
  };
};
