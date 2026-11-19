// Generates generated/web-theme.css (Tailwind v4 @theme) from the compiled
// tokens, so the web admin's CSS is always in sync with src/tokens.ts.
// Runs after `tsup` in `npm run build`. It lives OUTSIDE dist/ on purpose:
// `tsup --clean` wipes dist/, and a running `next dev` must never see the
// stylesheet disappear mid-rebuild. Written atomically (temp file + rename).
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
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

mkdirSync(new URL('../generated/', import.meta.url), { recursive: true });
const target = new URL('../generated/web-theme.css', import.meta.url);
const tmp = new URL('../generated/web-theme.css.tmp', import.meta.url);
writeFileSync(tmp, css);
renameSync(tmp, target);
console.log('design-tokens: wrote generated/web-theme.css');
