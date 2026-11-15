import { createApi, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type {
  AiSettingsDto,
  AiSettingsUpdateInput,
  LoadCreateInput,
  LoadDetailDto,
  LoadDetailQuery,
  LoadListDto,
  LoadQueryInput,
  MeDto,
  UpdateMeInput,
  VehicleCreateInput,
  VehicleDto,
  VehicleLocationInput,
  VehicleUpdateInput,
} from '@dispatcher/shared';

export type DispatcherBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export const TAGS = ['Me', 'Vehicle', 'Load', 'AiSettings'] as const;

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
