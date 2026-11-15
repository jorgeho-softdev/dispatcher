// Bridges a theme's plain-hex color tree (lib/themes/*.js) into the two
// shapes NativeWind theming needs:
//  - `varNames`: the same nested shape, but every hex leaf replaced with a
//    `rgb(var(--x) / <alpha-value>)` reference. This is what
//    tailwind.config.js puts in `theme.extend.colors` — it's the same for
//    every theme (only the CSS variable *values* differ per theme), so
//    tailwind.config.js only needs to build it once from any one theme.
//  - `cssVars`: a flat `{ '--color-x': 'R G B' }` map of the actual values,
//    passed to NativeWind's `vars()` at runtime to make a given theme live.
function hexToRgbTriplet(hex) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r} ${g} ${b}`;
}

function buildColorVars(colorTree, prefix) {
  const varNames = {};
  const cssVars = {};
  for (const [key, value] of Object.entries(colorTree)) {
    const nextPrefix = key === 'DEFAULT' ? prefix : `${prefix}-${key}`;
    if (typeof value === 'string') {
      const varName = `--${nextPrefix}`;
      varNames[key] = `rgb(var(${varName}) / <alpha-value>)`;
      cssVars[varName] = hexToRgbTriplet(value);
    } else {
      const nested = buildColorVars(value, nextPrefix);
      varNames[key] = nested.varNames;
      Object.assign(cssVars, nested.cssVars);
    }
  }
  return { varNames, cssVars };
}

module.exports = { hexToRgbTriplet, buildColorVars };
