import { createMMKV } from 'react-native-mmkv';

// MMKV is synchronous and mmap-backed, so persisted slices are read in the
// same tick the store is created (as preloadedState) — no hydration step and
// no flash of default values. Never store secrets here: tokens go in
// expo-secure-store (lib/secure-tokens.ts).
export const mmkvStorage = createMMKV();

export function readJSON<T>(key: string): T | undefined {
  const raw = mmkvStorage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown): void {
  mmkvStorage.set(key, JSON.stringify(value));
}
