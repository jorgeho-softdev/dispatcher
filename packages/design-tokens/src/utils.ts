import type { ThemeColorTree } from './tokens';

/**
 * `{ primary: { DEFAULT, dark } }` → `{ primary: '#…', 'primary-dark': '#…' }`.
 * Same naming Tailwind uses for nested colors.
 */
export function flattenColorTree(tree: ThemeColorTree | Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'string') out[name] = value;
    else Object.assign(out, flattenColorTree(value as Record<string, unknown>, name));
  }
  return out;
}

/** `{ 'primary-dark': '#…' }` → `--color-primary-dark: #…;` lines. */
export function toCssVariables(tree: ThemeColorTree): string[] {
  return Object.entries(flattenColorTree(tree)).map(([name, hex]) => `--color-${name}: ${hex};`);
}
