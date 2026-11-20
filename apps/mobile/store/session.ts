import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  toErrorCode,
  type ApiErrorDto,
  type AuthResponseDto,
  type ErrorCode,
  type LoginInput,
  type RegisterInput,
} from '@dispatcher/shared';
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

/**
 * POSTs credentials to an auth endpoint and starts the session. Rejects with
 * an ErrorCode the UI translates (errors.<CODE> in packages/i18n).
 */
async function authenticate(
  path: '/auth/login' | '/auth/register',
  input: LoginInput | RegisterInput,
  dispatch: AppDispatch,
): Promise<ErrorCode | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return 'NETWORK_ERROR';
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorDto>;
    return toErrorCode(body.code);
  }
  const auth = (await res.json()) as AuthResponseDto;
  await secureTokens.setRefreshToken(auth.refreshToken);
  dispatch(sessionStarted({ accessToken: auth.accessToken, me: auth.me }));
  return null;
}

export const signIn = createAppAsyncThunk<void, LoginInput, { rejectValue: ErrorCode }>(
  'session/signIn',
  async (input, { dispatch, rejectWithValue }) => {
    const error = await authenticate('/auth/login', input, dispatch);
    if (error) return rejectWithValue(error);
  },
);

/** Self sign-up: creates the user + their organization (as owner) and signs in. */
export const signUp = createAppAsyncThunk<void, RegisterInput, { rejectValue: ErrorCode }>(
  'session/signUp',
  async (input, { dispatch, rejectWithValue }) => {
    const error = await authenticate('/auth/register', input, dispatch);
    if (error) return rejectWithValue(error);
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
