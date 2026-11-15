import { createApi, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type {
  LoadDto,
  LoadQuery,
  MeDto,
  Paginated,
  UpdateMeInput,
  VehicleCreateInput,
  VehicleDto,
  VehicleUpdateInput,
} from '@dispatcher/shared';

export type DispatcherBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export const TAGS = ['Me', 'Vehicle', 'Load'] as const;

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

      getLoads: build.query<Paginated<LoadDto>, Partial<LoadQuery> | void>({
        query: (params) => ({ url: '/loads', params: params ?? undefined }),
        providesTags: (result) => [
          ...(result?.items.map((l) => ({ type: 'Load' as const, id: l.id })) ?? []),
          { type: 'Load', id: 'LIST' },
        ],
      }),
      getLoad: build.query<LoadDto, string>({
        query: (id) => `/loads/${id}`,
        providesTags: (_r, _e, id) => [{ type: 'Load', id }],
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
