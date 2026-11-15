import { themes as tokenThemes, defaultTheme, type ThemeColorTree, type ThemeTokens } from '@dispatcher/design-tokens';
import { buildColorVars } from './theme-utils';

// Color values come from packages/design-tokens/src/tokens.ts — never add hex
// values here. This file only adapts the shared tokens to what React Native
// needs at runtime.

// Flat JS palette for anywhere a Tailwind className can't apply — icon
// `color=` props, RN `style` objects, navigator options. Mirrors the
// classNames a theme's nested `colors` produce (e.g. `colors.primary.dark`
// -> `bg-primary-dark` in Tailwind, `primaryDark` here).
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  ink: string;
  muted: string;
  mutedLight: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  success: string;
  danger: string;
  info: string;
  warning: string;
  white: string;
  black: string;
  onPrimary: string;
}

export interface Theme {
  id: string;
  name: string;
  statusBarStyle: 'light' | 'dark';
  colors: ThemeColors;
  // Flat `{ '--color-x': 'R G B' }` map for NativeWind's `vars()`, applied at
  // the app root so every `bg-*`/`text-*` className resolves to this theme's
  // values at runtime.
  cssVars: Record<string, string>;
}

function flattenColors(nested: ThemeColorTree): ThemeColors {
  return {
    background: nested.background,
    surface: nested.surface,
    surfaceRaised: nested['surface-raised'],
    border: nested.border,
    ink: nested.ink,
    muted: nested.muted.DEFAULT,
    mutedLight: nested.muted.light,
    primary: nested.primary.DEFAULT,
    primaryDark: nested.primary.dark,
    primaryLight: nested.primary.light,
    success: nested.success,
    danger: nested.danger,
    info: nested.info,
    warning: nested.warning,
    white: nested.white,
    black: nested.black,
    onPrimary: nested['on-primary'],
  };
}

function makeTheme(id: string, name: string, raw: ThemeTokens): Theme {
  return {
    id,
    name,
    statusBarStyle: raw.statusBarStyle,
    colors: flattenColors(raw.colors),
    cssVars: buildColorVars(raw.colors, 'color').cssVars,
  };
}

// Registry of every available theme. To add one: add it to `themes` in
// packages/design-tokens/src/tokens.ts and register it here.
export const themes = {
  dark: makeTheme('dark', 'Dark', tokenThemes.dark),
  light: makeTheme('light', 'Light', tokenThemes.light),
};

export type ThemeId = keyof typeof themes;

export const defaultThemeId: ThemeId = defaultTheme;

// For rendering a theme picker without importing the whole registry.
export const themeList: { id: ThemeId; name: string }[] = (Object.keys(themes) as ThemeId[]).map((id) => ({
  id,
  name: themes[id].name,
}));
