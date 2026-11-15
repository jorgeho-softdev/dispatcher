import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MeDto } from '@dispatcher/shared';

// The access token lives only in memory (Redux). The long-lived refresh
// token lives only in the OS keychain/keystore (lib/secure-tokens.ts).
export type AuthStatus = 'booting' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  me: MeDto | null;
}

const initialState: AuthState = { status: 'booting', accessToken: null, me: null };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<{ accessToken: string; me: MeDto }>) {
      state.status = 'signedIn';
      state.accessToken = action.payload.accessToken;
      state.me = action.payload.me;
    },
    meUpdated(state, action: PayloadAction<MeDto>) {
      state.me = action.payload;
    },
    sessionEnded() {
      return { ...initialState, status: 'signedOut' as const };
    },
  },
  selectors: {
    selectAuthStatus: (s) => s.status,
    selectAccessToken: (s) => s.accessToken,
    selectMe: (s) => s.me,
  },
});

export const { sessionStarted, meUpdated, sessionEnded } = authSlice.actions;
export const { selectAuthStatus, selectAccessToken, selectMe } = authSlice.selectors;
