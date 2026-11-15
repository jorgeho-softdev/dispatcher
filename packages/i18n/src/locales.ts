// ════════════════════════════════════════════════════════════════════════
//  Supported languages — single source of truth for api, web and mobile.
//  To add a language, see docs/i18n.md (add it here + messages/<code>.json).
// ════════════════════════════════════════════════════════════════════════

export const LOCALES = ['en', 'fr', 'es', 'pa'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export interface LocaleInfo {
  /** Name in the language itself — shown in language pickers (never use flags: languages aren't countries). */
  nativeName: string;
  englishName: string;
  /** Text direction. Ready for Urdu / Arabic / Farsi when they are added. */
  dir: 'ltr' | 'rtl';
  /** BCP-47 tag used for Intl number/date/currency formatting. */
  intlLocale: string;
  /**
   * `reviewed`: checked by a native speaker.
   * `needs_review`: machine/draft translation — must be reviewed before launch.
   */
  status: 'reviewed' | 'needs_review';
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr', intlLocale: 'en-CA', status: 'reviewed' },
  fr: { nativeName: 'Français', englishName: 'French', dir: 'ltr', intlLocale: 'fr-CA', status: 'needs_review' },
  es: { nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', intlLocale: 'es-419', status: 'reviewed' },
  // Punjabi in Gurmukhi script (most common among Canadian drivers).
  pa: { nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', dir: 'ltr', intlLocale: 'pa-Guru-IN', status: 'needs_review' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the best supported locale from a preference list (device locales,
 * Accept-Language, user profile…). `fr-CA` → `fr`, `pa-Guru-IN` → `pa`,
 * unknown → DEFAULT_LOCALE.
 */
export function negotiateLocale(candidates: readonly (string | null | undefined)[]): Locale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.toLowerCase().replace('_', '-');
    if (isLocale(normalized)) return normalized;
    const base = normalized.split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Parses an Accept-Language header into tags ordered by quality. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag?.trim() ?? '', q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((x) => x.tag && x.tag !== '*' && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}
