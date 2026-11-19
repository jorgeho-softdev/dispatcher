// Generates every derived brand image from the two originals in
// packages/design-tokens/brand/ (see docs/design-system.md → "Nombre y logo"):
//
//   mark.png      the H-arrow symbol, transparent background
//   logotype.png  symbol + "HaulGenius" wordmark, transparent background
//
// Run after replacing either original:  npm run brand:assets
// Outputs are committed (the apps read them as static files).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { themes, defaultTheme } = require('@dispatcher/design-tokens');
const { ink, surface } = themes[defaultTheme].colors;

const SRC = 'packages/design-tokens/brand';
const out = (p) => {
  mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
  return p;
};

/** Bounding box of visible, non-white pixels (the originals carry wide margins). */
async function contentBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const white = data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
      if (data[i + 3] > 20 && !white) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Trims to content and centres it on a transparent canvas with `pad` margin. */
async function trimmed(input, { pad = 0.04, square = false } = {}) {
  const box = await contentBox(input);
  const crop = await sharp(input).extract(box).png().toBuffer();
  const w = Math.round((square ? Math.max(box.width, box.height) : box.width) * (1 + 2 * pad));
  const h = Math.round((square ? w : box.height * (1 + 2 * pad)));
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: crop, left: Math.round((w - box.width) / 2), top: Math.round((h - box.height) / 2) }])
    .png()
    .toBuffer();
}

/** For dark UIs: the near-black, unsaturated wordmark pixels ("Haul") take the ink token. */
async function onDark(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (data[i + 3] > 0 && max < 140 && max - min < 30) [data[i], data[i + 1], data[i + 2]] = [r, g, b];
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

const mark = await trimmed(`${SRC}/mark.png`, { square: true });
const logoLight = await trimmed(`${SRC}/logotype.png`);
const logoDark = await onDark(logoLight);

await sharp(mark).resize(1024, 1024).toFile(out('apps/mobile/assets/splash-icon.png'));
await sharp(logoDark).resize({ width: 960 }).toFile(out('apps/mobile/assets/logo-on-dark.png'));
await sharp(logoLight).resize({ width: 960 }).toFile(out('apps/mobile/assets/logo-on-light.png'));
await sharp(logoDark).resize({ width: 960 }).toFile(out('apps/web/public/brand/logo-on-dark.png'));
await sharp(mark).resize(256, 256).toFile(out('apps/web/public/brand/mark.png'));
await sharp(mark).resize(512, 512).toFile(out('apps/web/src/app/icon.png'));

// ── App icons ──────────────────────────────────────────────────────────
// iOS: full-bleed square (iOS applies its own rounded mask; never pre-round
// it, never transparent), 1024 px, symbol at 57% of the width on `surface`.
const ICON = 1024;
const fit = async (fraction) => {
  const side = Math.round(ICON * fraction);
  const symbol = await sharp(await trimmed(`${SRC}/mark.png`, { pad: 0, square: true })).resize(side, side).toBuffer();
  return { input: symbol, left: Math.round((ICON - side) / 2), top: Math.round((ICON - side) / 2) };
};
const canvas = (background) => sharp({ create: { width: ICON, height: ICON, channels: 4, background } });
await canvas(surface).composite([await fit(0.57)]).flatten({ background: surface }).removeAlpha().png()
  .toFile(out('apps/mobile/assets/icon.png'));
// Android adaptive icon: the launcher crops to the central ~66%, so the
// symbol is smaller on the foreground layer; the background is a solid color
// set in app.config.ts (`surface`). Monochrome = white silhouette (Android 13+ themed icons).
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const foreground = await fit(0.38);
await canvas(transparent).composite([foreground]).png().toFile(out('apps/mobile/assets/android-icon-foreground.png'));
const { data: fg, info: fgInfo } = await sharp(foreground.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < fg.length; i += 4) {
  const arrow = fg[i] > 200 && fg[i + 1] > 200 && fg[i + 2] > 170; // the cream arrow becomes a cut-out
  fg[i] = fg[i + 1] = fg[i + 2] = 255;
  if (arrow) fg[i + 3] = 0;
}
const white = await sharp(fg, { raw: fgInfo }).png().toBuffer();
await canvas(transparent).composite([{ ...foreground, input: white }]).png().toFile(out('apps/mobile/assets/android-icon-monochrome.png'));

console.log('brand: splash, logos, app icons and web icon regenerated');
