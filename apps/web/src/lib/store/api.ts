import { fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { createDispatcherApi, type DispatcherBaseQuery } from '@dispatcher/api-client';

// Web talks only to its own BFF (/api/backend/*). Cookies ride along
// automatically; the BFF injects the bearer token and refreshes it.
const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api/backend' });

const baseQuery: DispatcherBaseQuery = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);
  // The BFF already tried a refresh; a 401 here means the session is gone.
  if ((result.error as FetchBaseQueryError | undefined)?.status === 401 && typeof window !== 'undefined') {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: wipes the Redux store and cached data of the old session
    window.location.assign('/login');
  }
  return result;
};

export const dispatcherApi = createDispatcherApi(baseQuery);

export const {
  useGetMeQuery,
  useUpdateMeMutation,
  useGetLoadsQuery,
  useGetLoadPagesInfiniteQuery,
  useCreateLoadMutation,
  useGetAiSettingsQuery,
  useGetNegotiationsQuery,
  useGetNegotiationQuery,
  useApproveSendMutation,
  useApproveBookingMutation,
  useCancelNegotiationMutation,
  useGetTripsQuery,
  useGetTripQuery,
  useGetDocumentDownloadUrlMutation,
  useCompleteTripMutation,
  useUpdateAiSettingsMutation,
  useGetLoadQuery,
  useGetVehiclesQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
} = dispatcherApi;
