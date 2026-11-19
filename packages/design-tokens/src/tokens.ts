// ════════════════════════════════════════════════════════════════════════
//  HaulGenius — BRAND TOKENS (single source of truth)
//
//  Every color and font used by apps/web and apps/mobile comes from this
//  file. To rebrand, edit ONLY the values below, then run:
//      npm run build --workspace=@dispatcher/design-tokens
//  and restart the apps. See docs/design-system.md.
//
//  Rules:
//   - Keep the SAME keys in every theme (only the hex values change).
//   - Hex values only (#RRGGBB). Components never hardcode colors; they use
//     the generated classNames (bg-primary, text-ink…) or useColors().
// ════════════════════════════════════════════════════════════════════════

/** Raw brand palette. Themes below pick from it. */
export const palette = {
  orange500: '#FF7A00',
  orange700: '#CC6200',
  orange900: '#3E2716',
  orange100: '#F7E5D6',

  night950: '#14151B',
  night900: '#1C1D26',
  night800: '#242633',
  night700: '#2B2C3A',
  gray500: '#8D8FA0',
  gray600: '#6C6E80',

  snow50: '#F6F6F9',
  snow100: '#EDEDF2',
  snow200: '#E4E4EA',
  slate900: '#111216',
  slate500: '#6B6D7B',
  slate400: '#9A9CA8',

  green500: '#22C55E',
  red600: '#DC2626',
  sky500: '#0EA5E9',
  yellow400: '#F2C230',
  white: '#FFFFFF',
  black: '#000000',
} as const;

const p = palette;

/**
 * Semantic color roles. Nested objects become dashed classNames:
 * `primary.dark` → `bg-primary-dark`, `muted.DEFAULT` → `text-muted`.
 */
export type ThemeColorTree = {
  background: string;
  surface: string;
  'surface-raised': string;
  border: string;
  ink: string;
  muted: { DEFAULT: string; light: string };
  primary: { DEFAULT: string; dark: string; light: string };
  'on-primary': string;
  success: string;
  danger: string;
  info: string;
  warning: string;
  white: string;
  black: string;
};

export interface ThemeTokens {
  /** Status bar icons on mobile: light icons for dark backgrounds. */
  statusBarStyle: 'light' | 'dark';
  colors: ThemeColorTree;
}

export const themes = {
  dark: {
    statusBarStyle: 'light',
    colors: {
      background: p.night950,
      surface: p.night900,
      'surface-raised': p.night800,
      border: p.night700,
      ink: p.white,
      muted: { DEFAULT: p.gray500, light: p.gray600 },
      primary: { DEFAULT: p.orange500, dark: p.orange700, light: p.orange900 },
      'on-primary': p.white,
      success: p.green500,
      danger: p.red600,
      info: p.sky500,
      warning: p.yellow400,
      white: p.white,
      black: p.black,
    },
  },
  light: {
    statusBarStyle: 'dark',
    colors: {
      background: p.snow50,
      surface: p.white,
      'surface-raised': p.snow100,
      border: p.snow200,
      ink: p.slate900,
      muted: { DEFAULT: p.slate500, light: p.slate400 },
      primary: { DEFAULT: p.orange500, dark: p.orange700, light: p.orange100 },
      'on-primary': p.white,
      success: p.green500,
      danger: p.red600,
      info: p.sky500,
      warning: p.yellow400,
      white: p.white,
      black: p.black,
    },
  },
} as const satisfies Record<string, ThemeTokens>;

export type ThemeName = keyof typeof themes;

/** Theme the apps start with (and the only one the web admin uses today). */
export const defaultTheme: ThemeName = 'dark';

/**
 * Typography. `family` is the brand font's display name. The font FILES are
 * loaded in one module per app (they need platform-specific packages):
 *   - web:    apps/web/src/app/fonts.ts      (next/font/google)
 *   - mobile: apps/mobile/lib/fonts.ts       (@expo-google-fonts/*)
 * Changing the font = update `family` here + the import in those two files.
 */
export const typography = {
  family: 'Inter',
  /** Generic aliases used by the apps; never reference a font file name directly. */
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  /**
   * Font names registered on mobile (React Native needs one name per weight).
   * Tailwind classes (font-sans, font-sans-bold…) and screens use these, so
   * swapping the font never touches components.
   */
  mobileAliases: {
    regular: 'Brand-Regular',
    medium: 'Brand-Medium',
    semibold: 'Brand-SemiBold',
    bold: 'Brand-Bold',
  },
} as const;

export const radii = {
  sm: 8,
  md: 12,
  card: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
