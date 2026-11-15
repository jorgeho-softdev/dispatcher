import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IntlMessageFormat } from 'intl-messageformat';
import { ERROR_CODES } from '@dispatcher/shared';
import { LOCALES, LOCALE_INFO, MESSAGES } from './index';

// Flattens { a: { b: 'x' } } → { 'a.b': 'x' }.
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}

/** Top-level ICU argument names, e.g. "Hi, {name}" → ["name"]. */
function argumentsOf(message: string, locale: string): string[] {
  const ast = new IntlMessageFormat(message, locale).getAst();
  return ast
    .filter((el) => 'value' in el && el.type !== 0 /* literal */)
    .map((el) => (el as { value: string }).value)
    .sort();
}

const source = flatten(MESSAGES.en);

for (const locale of LOCALES) {
  const catalog = flatten(MESSAGES[locale]);

  test(`${locale}: has exactly the same keys as en`, () => {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(source).sort());
  });

  test(`${locale}: every message is valid ICU with the same arguments as en`, () => {
    for (const [key, message] of Object.entries(catalog)) {
      assert.ok(message.trim().length > 0, `${locale}:${key} is empty`);
      assert.deepEqual(
        argumentsOf(message, LOCALE_INFO[locale].intlLocale),
        argumentsOf(source[key]!, 'en'),
        `${locale}:${key} arguments differ from en`,
      );
    }
  });
}

test('every api error code has a translation', () => {
  for (const code of ERROR_CODES) {
    assert.ok(source[`errors.${code}`], `missing errors.${code}`);
  }
});
