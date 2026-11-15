import type { Locale } from '@dispatcher/i18n';
import type { ThemeId } from '@/lib/themes';

export type Language = Locale;

export interface AppSettings {
  language: Language;
  themeId: ThemeId;
  notificationsEnabled: boolean;
}
