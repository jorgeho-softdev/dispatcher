// Generates dist/web-theme.css (Tailwind v4 @theme) from the compiled tokens,
// so the web admin's CSS is always in sync with src/tokens.ts.
// Runs automatically after `tsup` in `npm run build`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { themes, defaultTheme, radii, toCssVariables } = require('../dist/index.js');

const theme = themes[defaultTheme];
const css = `/* AUTO-GENERATED from packages/design-tokens/src/tokens.ts — do not edit. */
@theme {
${toCssVariables(theme.colors)
  .map((l) => `  ${l}`)
  .join('\n')}
  --radius-card: ${radii.card}px;
  /* --font-brand is set by next/font in apps/web/src/app/fonts.ts */
  --font-sans: var(--font-brand), ui-sans-serif, system-ui, sans-serif;
}
`;

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/web-theme.css', import.meta.url), css);
console.log('design-tokens: wrote dist/web-theme.css');
