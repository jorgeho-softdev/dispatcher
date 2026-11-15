import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AuthResponseDto } from '@dispatcher/shared';
import { createDispatcherApi, type DispatcherBaseQuery } from '@dispatcher/api-client';
import { API_URL } from '@/lib/config';
import { secureTokens } from '@/lib/secure-tokens';
import { sessionEnded, sessionStarted } from './auth-slice';
import type { AppDispatch, RootState } from './index';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * Exchanges the stored refresh token for a new session. The api rotates the
 * refresh token on every call, so the new one replaces the old one at once.
 */
export async function refreshSession(dispatch: AppDispatch): Promise<boolean> {
  const refreshToken = await secureTokens.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      // Only a definitive rejection logs the user out; network errors don't.
      if (res.status === 401) await secureTokens.clear();
      return false;
    }
    const auth = (await res.json()) as AuthResponseDto;
    await secureTokens.setRefreshToken(auth.refreshToken);
    dispatch(sessionStarted({ accessToken: auth.accessToken, me: auth.me }));
    return true;
  } catch {
    return false;
  }
}

// Single-flight: many requests failing with 401 at once trigger ONE refresh.
// (Parallel refreshes would trip the api's refresh-token reuse detection.)
let refreshInFlight: Promise<boolean> | null = null;

const baseQueryWithReauth: DispatcherBaseQuery = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);
  if (result.error?.status === 401) {
    refreshInFlight ??= refreshSession(api.dispatch as AppDispatch).finally(() => {
      refreshInFlight = null;
    });
    if (await refreshInFlight) {
      result = await rawBaseQuery(args, api, extra);
    } else {
      api.dispatch(sessionEnded());
    }
  }
  return result;
};

export const dispatcherApi = createDispatcherApi(baseQueryWithReauth);

export const {
  useGetMeQuery,
  useGetLoadsQuery,
  useGetLoadPagesInfiniteQuery,
  useGetLoadQuery,
  useGetVehiclesQuery,
  useReportVehicleLocationMutation,
  useGetNegotiationsQuery,
  useGetNegotiationQuery,
  useStartNegotiationMutation,
  useApproveSendMutation,
  useAdjustOfferMutation,
  useApproveBookingMutation,
  useCancelNegotiationMutation,
  useRegisterDeviceMutation,
} = dispatcherApi;
