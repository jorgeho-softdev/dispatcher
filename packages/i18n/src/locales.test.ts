import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negotiateLocale, parseAcceptLanguage } from './locales';

test('negotiates regional and script variants to the base language', () => {
  assert.equal(negotiateLocale(['fr-CA']), 'fr');
  assert.equal(negotiateLocale(['pa-Guru-IN']), 'pa');
  assert.equal(negotiateLocale(['es_MX']), 'es');
});

test('skips unsupported languages and falls back to English', () => {
  assert.equal(negotiateLocale(['tl-PH', 'es']), 'es');
  assert.equal(negotiateLocale(['zh-Hans', null, undefined]), 'en');
  assert.equal(negotiateLocale([]), 'en');
});

test('parses Accept-Language by quality', () => {
  assert.deepEqual(parseAcceptLanguage('en;q=0.5, pa-IN, fr;q=0.8, *;q=0.1'), ['pa-IN', 'fr', 'en']);
  assert.deepEqual(parseAcceptLanguage(undefined), []);
});
