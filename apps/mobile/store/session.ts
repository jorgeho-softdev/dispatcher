import { createAsyncThunk } from '@reduxjs/toolkit';
import { toErrorCode, type ApiErrorDto, type AuthResponseDto, type ErrorCode, type LoginInput } from '@dispatcher/shared';
import { API_URL } from '@/lib/config';
import { secureTokens } from '@/lib/secure-tokens';
import { dispatcherApi, refreshSession } from './api';
import { sessionEnded, sessionStarted } from './auth-slice';
import type { AppDispatch, RootState } from './index';

const createAppAsyncThunk = createAsyncThunk.withTypes<{ state: RootState; dispatch: AppDispatch }>();

/** Runs once at launch: restores the session from the keychain, if any. */
export const bootstrapSession = createAppAsyncThunk('session/bootstrap', async (_: void, { dispatch }) => {
  const ok = await refreshSession(dispatch);
  if (!ok) dispatch(sessionEnded());
});

/** Rejects with an ErrorCode the UI translates (errors.<CODE> in packages/i18n). */
export const signIn = createAppAsyncThunk<void, LoginInput, { rejectValue: ErrorCode }>(
  'session/signIn',
  async (input, { dispatch, rejectWithValue }) => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      return rejectWithValue('NETWORK_ERROR');
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorDto>;
      return rejectWithValue(toErrorCode(body.code));
    }

    const auth = (await res.json()) as AuthResponseDto;
    await secureTokens.setRefreshToken(auth.refreshToken);
    dispatch(sessionStarted({ accessToken: auth.accessToken, me: auth.me }));
  },
);

export const signOut = createAppAsyncThunk('session/signOut', async (_: void, { dispatch }) => {
  const refreshToken = await secureTokens.getRefreshToken();
  await secureTokens.clear();
  // Clear cached server data so the next user never sees the previous one's.
  dispatch(dispatcherApi.util.resetApiState());
  dispatch(sessionEnded());
  if (refreshToken) {
    // Best effort server-side revocation.
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
});
