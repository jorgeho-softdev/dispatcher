import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppSettings } from '@/types';
import { isLocale } from '@dispatcher/i18n';
import { deviceLocale } from '@/lib/i18n';
import { defaultThemeId } from '@/lib/themes';
import { readJSON, writeJSON } from './storage';

export interface SettingsState {
  settings: AppSettings;
  // Gates the first-run OnboardingScreen — false only on a fresh install.
  hasCompletedOnboarding: boolean;
}

const PERSIST_KEY = 'settings:v1';

export const defaultSettings: AppSettings = {
  // First launch uses the device language when supported (pa-IN → pa…).
  language: deviceLocale(),
  themeId: defaultThemeId,
  notificationsEnabled: false,
};

/** Synchronous MMKV read used as the store's preloadedState. */
export function loadSettingsState(): SettingsState {
  const saved = readJSON<Partial<SettingsState>>(PERSIST_KEY);
  return {
    // Merging with defaults fills keys added in later app versions.
    settings: {
      ...defaultSettings,
      ...saved?.settings,
      // A language removed in a later version falls back to the device one.
      language: isLocale(saved?.settings?.language) ? saved.settings.language : defaultSettings.language,
    },
    hasCompletedOnboarding: saved?.hasCompletedOnboarding ?? false,
  };
}

export function persistSettingsState(state: SettingsState): void {
  writeJSON(PERSIST_KEY, state);
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadSettingsState,
  reducers: {
    updateSettings(state, action: PayloadAction<Partial<AppSettings>>) {
      state.settings = { ...state.settings, ...action.payload };
    },
    resetSettings(state) {
      state.settings = defaultSettings;
    },
    completeOnboarding(state) {
      state.hasCompletedOnboarding = true;
    },
    resetOnboarding(state) {
      state.hasCompletedOnboarding = false;
    },
  },
  selectors: {
    selectSettings: (s) => s.settings,
    selectLanguage: (s) => s.settings.language,
    selectThemeId: (s) => s.settings.themeId,
    selectHasCompletedOnboarding: (s) => s.hasCompletedOnboarding,
  },
});

export const { updateSettings, resetSettings, completeOnboarding, resetOnboarding } = settingsSlice.actions;
export const { selectSettings, selectLanguage, selectThemeId, selectHasCompletedOnboarding } =
  settingsSlice.selectors;
