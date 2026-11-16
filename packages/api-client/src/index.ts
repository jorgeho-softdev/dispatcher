import { createApi, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type {
  AdjustOfferInput,
  AiSettingsDto,
  AiSettingsUpdateInput,
  BrokerRatingInput,
  DownloadUrlDto,
  ExpenseCreateInput,
  LoadCreateInput,
  LoadDetailDto,
  LoadDetailQuery,
  LoadListDto,
  LoadQueryInput,
  MeDto,
  NegotiationDetailDto,
  NegotiationDto,
  NegotiationListQuery,
  RegisterDeviceInput,
  StartNegotiationInput,
  TripDetailDto,
  TripDto,
  TripListQuery,
  TripLocationsInput,
  TripStatusUpdateInput,
  UploadRequestInput,
  UploadUrlDto,
  UpdateMeInput,
  VehicleCreateInput,
  VehicleDto,
  VehicleLocationInput,
  VehicleUpdateInput,
} from '@dispatcher/shared';

export type DispatcherBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export const TAGS = ['Me', 'Vehicle', 'Load', 'AiSettings', 'Negotiation', 'Trip'] as const;

/**
 * Builds the RTK Query api used by both clients. Paths are relative to the
 * api's `/v1` prefix — each app's baseQuery decides the host and auth:
 * web goes through its Next.js BFF (httpOnly cookies), mobile calls the api
 * directly with a bearer token.
 */
export function createDispatcherApi(baseQuery: DispatcherBaseQuery) {
  return createApi({
    reducerPath: 'dispatcherApi',
    baseQuery,
    tagTypes: TAGS,
    endpoints: (build) => ({
      getMe: build.query<MeDto, void>({
        query: () => '/me',
        providesTags: ['Me'],
      }),
      updateMe: build.mutation<MeDto, UpdateMeInput>({
        query: (body) => ({ url: '/me', method: 'PATCH', body }),
        invalidatesTags: ['Me'],
      }),

      getLoads: build.query<LoadListDto, LoadQueryInput | void>({
        query: (params) => ({ url: '/loads', params: params ?? undefined }),
        providesTags: (result) => [
          ...(result?.items.map((l) => ({ type: 'Load' as const, id: l.id })) ?? []),
          { type: 'Load', id: 'LIST' },
        ],
      }),
      /** Cursor-paginated list for "load more" / infinite scroll (web table, mobile FlatList). */
      getLoadPages: build.infiniteQuery<LoadListDto, LoadQueryInput, string>({
        infiniteQueryOptions: {
          initialPageParam: '',
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        },
        query: ({ queryArg, pageParam }) => ({
          url: '/loads',
          params: { ...queryArg, ...(pageParam && { cursor: pageParam }) },
        }),
        providesTags: [{ type: 'Load', id: 'LIST' }],
      }),
      getLoad: build.query<LoadDetailDto, { id: string } & Partial<LoadDetailQuery>>({
        query: ({ id, ...params }) => ({ url: `/loads/${id}`, params }),
        providesTags: (_r, _e, { id }) => [{ type: 'Load', id }],
      }),
      /** Manual load (cities from the catalog; coordinates/distance optional). */
      createLoad: build.mutation<LoadDetailDto, LoadCreateInput>({
        query: (body) => ({ url: '/loads', method: 'POST', body }),
        invalidatesTags: [{ type: 'Load', id: 'LIST' }],
      }),

      getAiSettings: build.query<AiSettingsDto, void>({
        query: () => '/ai-settings',
        providesTags: ['AiSettings'],
      }),
      updateAiSettings: build.mutation<AiSettingsDto, AiSettingsUpdateInput>({
        query: (body) => ({ url: '/ai-settings', method: 'PATCH', body }),
        // Preferences change every match score.
        invalidatesTags: ['AiSettings', { type: 'Load', id: 'LIST' }],
      }),

      // ── Negotiations (Phase 2) ──────────────────────────────────────
      getNegotiations: build.query<NegotiationDto[], Partial<NegotiationListQuery> | void>({
        query: (params) => ({ url: '/negotiations', params: params ?? undefined }),
        providesTags: (result) => [
          ...(result?.map((n) => ({ type: 'Negotiation' as const, id: n.id })) ?? []),
          { type: 'Negotiation', id: 'LIST' },
        ],
      }),
      getNegotiation: build.query<NegotiationDetailDto, string>({
        query: (id) => `/negotiations/${id}`,
        providesTags: (_r, _e, id) => [{ type: 'Negotiation', id }],
      }),
      startNegotiation: build.mutation<NegotiationDetailDto, StartNegotiationInput>({
        query: (body) => ({ url: '/negotiations', method: 'POST', body }),
        invalidatesTags: [{ type: 'Negotiation', id: 'LIST' }],
      }),
      approveSend: build.mutation<NegotiationDetailDto, string>({
        query: (id) => ({ url: `/negotiations/${id}/approve-send`, method: 'POST' }),
        invalidatesTags: (_r, _e, id) => [{ type: 'Negotiation', id }, { type: 'Negotiation', id: 'LIST' }],
      }),
      adjustOffer: build.mutation<NegotiationDetailDto, { id: string } & AdjustOfferInput>({
        query: ({ id, ...body }) => ({ url: `/negotiations/${id}/adjust`, method: 'POST', body }),
        invalidatesTags: (_r, _e, { id }) => [{ type: 'Negotiation', id }],
      }),
      approveBooking: build.mutation<NegotiationDetailDto, string>({
        query: (id) => ({ url: `/negotiations/${id}/approve-booking`, method: 'POST' }),
        invalidatesTags: (_r, _e, id) => [
          { type: 'Negotiation', id },
          { type: 'Negotiation', id: 'LIST' },
          { type: 'Trip', id: 'LIST' },
        ],
      }),
      cancelNegotiation: build.mutation<NegotiationDetailDto, string>({
        query: (id) => ({ url: `/negotiations/${id}/cancel`, method: 'POST' }),
        invalidatesTags: (_r, _e, id) => [{ type: 'Negotiation', id }, { type: 'Negotiation', id: 'LIST' }],
      }),

      // ── Trips (Phase 3) ─────────────────────────────────────────────
      getTrips: build.query<TripDto[], Partial<TripListQuery> | void>({
        query: (params) => ({ url: '/trips', params: params ?? undefined }),
        providesTags: (result) => [
          ...(result?.map((t) => ({ type: 'Trip' as const, id: t.id })) ?? []),
          { type: 'Trip', id: 'LIST' },
        ],
      }),
      getTrip: build.query<TripDetailDto, string>({
        query: (id) => `/trips/${id}`,
        providesTags: (_r, _e, id) => [{ type: 'Trip', id }],
      }),
      updateTripStatus: build.mutation<TripDetailDto, { id: string } & TripStatusUpdateInput>({
        query: ({ id, ...body }) => ({ url: `/trips/${id}/status`, method: 'POST', body }),
        invalidatesTags: (_r, _e, { id }) => [{ type: 'Trip', id }, { type: 'Trip', id: 'LIST' }],
      }),
      /** GPS batch; doesn't invalidate the trip (the screen polls) to avoid refetch storms. */
      recordTripLocations: build.mutation<TripDto, { id: string } & TripLocationsInput>({
        query: ({ id, ...body }) => ({ url: `/trips/${id}/locations`, method: 'POST', body }),
      }),
      requestTripUpload: build.mutation<UploadUrlDto, { id: string } & UploadRequestInput>({
        query: ({ id, ...body }) => ({ url: `/trips/${id}/documents/upload-url`, method: 'POST', body }),
      }),
      completeTripUpload: build.mutation<TripDetailDto, { id: string; documentId: string }>({
        query: ({ id, documentId }) => ({ url: `/trips/${id}/documents/${documentId}/complete`, method: 'POST' }),
        invalidatesTags: (_r, _e, { id }) => [{ type: 'Trip', id }],
      }),
      getDocumentDownloadUrl: build.mutation<DownloadUrlDto, string>({
        // A mutation on purpose: every call must return a fresh short-lived URL.
        query: (id) => ({ url: `/documents/${id}/download-url`, method: 'GET' }),
      }),
      addTripExpense: build.mutation<TripDetailDto, { id: string } & ExpenseCreateInput>({
        query: ({ id, ...body }) => ({ url: `/trips/${id}/expenses`, method: 'POST', body }),
        invalidatesTags: (_r, _e, { id }) => [{ type: 'Trip', id }, { type: 'Trip', id: 'LIST' }],
      }),
      deleteTripExpense: build.mutation<TripDetailDto, { id: string; expenseId: string }>({
        query: ({ id, expenseId }) => ({ url: `/trips/${id}/expenses/${expenseId}`, method: 'DELETE' }),
        invalidatesTags: (_r, _e, { id }) => [{ type: 'Trip', id }, { type: 'Trip', id: 'LIST' }],
      }),
      completeTrip: build.mutation<TripDetailDto, string>({
        query: (id) => ({ url: `/trips/${id}/complete`, method: 'POST' }),
        invalidatesTags: (_r, _e, id) => [{ type: 'Trip', id }, { type: 'Trip', id: 'LIST' }],
      }),
      cancelTrip: build.mutation<TripDetailDto, string>({
        query: (id) => ({ url: `/trips/${id}/cancel`, method: 'POST' }),
        invalidatesTags: (_r, _e, id) => [{ type: 'Trip', id }, { type: 'Trip', id: 'LIST' }, { type: 'Load', id: 'LIST' }],
      }),
      rateBroker: build.mutation<TripDetailDto, { id: string } & BrokerRatingInput>({
        query: ({ id, ...body }) => ({ url: `/trips/${id}/broker-rating`, method: 'POST', body }),
        invalidatesTags: (_r, _e, { id }) => [{ type: 'Trip', id }],
      }),

      /** Expo push token of this phone (mobile only). */
      registerDevice: build.mutation<void, RegisterDeviceInput>({
        query: (body) => ({ url: '/devices', method: 'POST', body }),
      }),

      getVehicles: build.query<VehicleDto[], void>({
        query: () => '/vehicles',
        providesTags: (result) => [
          ...(result?.map((v) => ({ type: 'Vehicle' as const, id: v.id })) ?? []),
          { type: 'Vehicle', id: 'LIST' },
        ],
      }),
      createVehicle: build.mutation<VehicleDto, VehicleCreateInput>({
        query: (body) => ({ url: '/vehicles', method: 'POST', body }),
        // Profit estimates depend on the fleet's cost per km.
        invalidatesTags: [{ type: 'Vehicle', id: 'LIST' }, { type: 'Load', id: 'LIST' }],
      }),
      updateVehicle: build.mutation<VehicleDto, { id: string; data: VehicleUpdateInput }>({
        query: ({ id, data }) => ({ url: `/vehicles/${id}`, method: 'PATCH', body: data }),
        invalidatesTags: (_r, _e, { id }) => [
          { type: 'Vehicle', id },
          { type: 'Load', id: 'LIST' },
        ],
      }),
      /** Driver app GPS fix; moves deadhead / "near me" to the real position. */
      reportVehicleLocation: build.mutation<void, { id: string } & VehicleLocationInput>({
        query: ({ id, ...body }) => ({ url: `/vehicles/${id}/location`, method: 'POST', body }),
        invalidatesTags: [{ type: 'Load', id: 'LIST' }],
      }),
      deleteVehicle: build.mutation<void, string>({
        query: (id) => ({ url: `/vehicles/${id}`, method: 'DELETE' }),
        invalidatesTags: (_r, _e, id) => [
          { type: 'Vehicle', id },
          { type: 'Load', id: 'LIST' },
        ],
      }),
    }),
  });
}

export type DispatcherApi = ReturnType<typeof createDispatcherApi>;
