import { IntlMessageFormat } from 'intl-messageformat';
import type { Locale } from './locales';
import { LOCALE_INFO } from './locales';
import { MESSAGES } from './index';

// Server-only entry (@dispatcher/i18n/server): keeps intl-messageformat out of
// the web/mobile bundles, which use use-intl's own ICU runtime.

type Primitive = string | number;

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Translates a catalog key outside React (api: push notifications, emails).
 * Falls back to English, then to the key itself — never throws.
 */
export function formatMessage(locale: Locale, key: string, params: Record<string, Primitive> = {}): string {
  const message = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.en, key);
  if (!message) return key;
  try {
    return String(new IntlMessageFormat(message, LOCALE_INFO[locale].intlLocale).format(params));
  } catch {
    return message;
  }
}
