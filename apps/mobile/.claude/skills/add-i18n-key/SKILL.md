---
name: add-i18n-key
description: Add a new translation key to the shared catalogs (packages/i18n/messages/*.json) across every supported language without missing one. Use whenever new UI text is added anywhere in the app.
---

# Adding an i18n key

Translations are **shared with the web admin** and live in
`../../packages/i18n/messages/<locale>.json` (one file per language: en, fr,
es, pa…). `en.json` is the source: the `Messages` type comes from it, so
`t('mobile.home.newKey')` fails typecheck until the key exists in `en.json`.
The package tests fail if any other language is missing the key or uses
different `{arguments}`. Full guide: `../../docs/i18n.md`.

## Procedure

1. Look for an existing similar key first (`common.*`, `auth.*`, `errors.*`,
   `domain.*` are shared by both apps) — don't duplicate.
2. Add the key to `en.json` under the right namespace: `mobile.<screen>.*`
   for app-only text, `common`/`domain`/`errors` for text both apps use.
   camelCase, descriptive.
3. Add the same key at the same path in **every** other catalog. Translate
   the meaning in the app's tone; don't transliterate. If you are not fluent,
   write your best translation and leave the language's `status` as
   `needs_review` in `packages/i18n/src/locales.ts`.
4. Use ICU syntax: `{name}` for variables, and plurals as
   `{count, plural, one {…} other {…}}`. Never build sentences by
   concatenating strings.
5. Verify:
   ```bash
   npm run build --workspace=@dispatcher/i18n && npm test --workspace=@dispatcher/i18n
   npm run typecheck   # in apps/mobile
   ```
6. Use it in a component: `const t = useTranslations();` (from `use-intl`)
   → `t('mobile.home.newKey')`. Outside React (notifications, tasks):
   `translatorFor(locale, 'mobile')` from `lib/i18n.ts`.

## Removing a key

Confirm nothing references it in either app
(`grep -rn "newKey" ../../apps --include=*.ts --include=*.tsx`), then remove
it from every catalog together.
