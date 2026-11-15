import en from '../messages/en.json';
import fr from '../messages/fr.json';
import es from '../messages/es.json';
import pa from '../messages/pa.json';
import type { Locale } from './locales';

export * from './locales';

/** English is the source catalog: every other locale must have exactly its keys. */
export type Messages = typeof en;

// Statically imported so every bundler (Next, Metro, Node) inlines them; the
// whole catalog set is small. Split per namespace if it ever grows large.
export const MESSAGES: Record<Locale, Messages> = { en, fr, es, pa };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
export { formatMessage } from './server';
