const { themes, defaultTheme, radii, typography } = require('@dispatcher/design-tokens');
const { buildColorVars } = require('./lib/theme-utils');

// Colors, radii and fonts come from packages/design-tokens/src/tokens.ts
// (single source of truth shared with the web admin).
//
// Every theme shares the same color *shape* — only the hex values differ. So
// the classNames Tailwind generates (`bg-primary`, `text-ink`, etc.) are built
// once here as CSS-variable references; which theme's actual values those
// variables hold is decided at runtime by NativeWind's `vars()` (see
// lib/themes.ts + app/_layout.tsx), not here.
const { varNames: themeColors } = buildColorVars(themes[defaultTheme].colors, 'color');
const fonts = typography.mobileAliases;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: themeColors,
      borderRadius: {
        card: `${radii.card}px`,
      },
      fontFamily: {
        sans: [fonts.regular, 'System'],
        'sans-medium': [fonts.medium, 'System'],
        'sans-semibold': [fonts.semibold, 'System'],
        'sans-bold': [fonts.bold, 'System'],
      },
    },
  },
  plugins: [],
};
