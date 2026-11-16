import { z } from 'zod';
import { AUTONOMY_LEVELS, CURRENCIES, EQUIPMENT_TYPES, LOAD_SOURCES, LOAD_STATUSES, LOAD_VIEWS } from './constants';
import { PROVINCES } from './geo';
import { ALLOWED_UPLOAD_MIME_TYPES, DOCUMENT_TYPES, EXPENSE_CATEGORIES, MAX_UPLOAD_BYTES } from './trips';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const queryLat = z.coerce.number().min(-90).max(90);
const queryLng = z.coerce.number().min(-180).max(180);

// Request schemas — validated by the api (ZodValidationPipe) and reused by
// web/mobile forms so both sides agree on every rule.

// Locale codes are validated loosely here (2–3 letter code) to keep shared
// free of the i18n package; the api checks them against LOCALES.
const localeCode = z.string().regex(/^[a-z]{2,3}$/);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  companyName: z.string().trim().min(2).max(120),
  locale: localeCode.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateMeSchema = z.object({
  locale: localeCode,
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const vehicleCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  equipment: z.enum(EQUIPMENT_TYPES),
  plate: z.string().trim().max(20).optional(),
  capacityKg: z.number().int().positive().max(40_000),
  costPerKm: z.number().positive().max(20),
  homeBaseCity: z.string().trim().max(80).optional(),
  homeBaseProvince: z.enum(PROVINCES).optional(),
  /** Optional: resolved from the city catalog when omitted. */
  homeBaseLat: lat.optional(),
  homeBaseLng: lng.optional(),
});
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = vehicleCreateSchema.partial();
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;

export const vehicleLocationSchema = z.object({ lat, lng });
export type VehicleLocationInput = z.infer<typeof vehicleLocationSchema>;

/** Matching context shared by the list and detail endpoints. */
const matchContext = {
  /** Vehicle to match against; defaults to the organization's first vehicle. */
  vehicleId: z.uuid().optional(),
  /** Explicit position (e.g. the phone's GPS); overrides the vehicle's. */
  lat: queryLat.optional(),
  lng: queryLng.optional(),
};

export const loadQuerySchema = z.object({
  view: z.enum(LOAD_VIEWS).default('all'),
  ...matchContext,
  /** "nearby" view radius around the position (km, straight line). */
  radiusKm: z.coerce.number().int().min(10).max(2000).default(250),
  equipment: z.enum(EQUIPMENT_TYPES).optional(),
  originProvince: z.string().length(2).optional(),
  status: z.enum(LOAD_STATUSES).optional(),
  includeSimulated: z.stringbool().default(true),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type LoadQuery = z.infer<typeof loadQuerySchema>;
/** What clients send: any subset of the parsed query (booleans are serialized to "true"/"false"). */
export type LoadQueryInput = Partial<LoadQuery>;

export const loadDetailQuerySchema = z.object(matchContext);
export type LoadDetailQuery = z.infer<typeof loadDetailQuerySchema>;

// Coordinates and distance are optional for manual loads: the api resolves
// catalog cities (CANADIAN_CITIES) and estimates road km when omitted.
export const loadCreateSchema = z.object({
  originCity: z.string().trim().min(1),
  originProvince: z.enum(PROVINCES),
  originLat: lat.optional(),
  originLng: lng.optional(),
  destinationCity: z.string().trim().min(1),
  destinationProvince: z.enum(PROVINCES),
  destinationLat: lat.optional(),
  destinationLng: lng.optional(),
  pickupAt: z.coerce.date(),
  distanceKm: z.number().positive().optional(),
  weightKg: z.number().int().positive(),
  equipment: z.enum(EQUIPMENT_TYPES),
  postedRate: z.number().positive(),
  currency: z.enum(CURRENCIES).default('CAD'),
  source: z.enum(LOAD_SOURCES).default('manual'),
  notes: z.string().max(1000).optional(),
});
export type LoadCreateInput = z.infer<typeof loadCreateSchema>;

export const aiSettingsSchema = z.object({
  autonomyLevel: z.enum(AUTONOMY_LEVELS),
  minRatePerKm: z.number().positive().max(20),
  minMarginPct: z.number().min(0).max(100),
  maxCounterOfferPct: z.number().min(0).max(100),
  maxDeadheadKm: z.number().int().min(0).max(2000),
  preferredProvinces: z.array(z.enum(PROVINCES)).max(PROVINCES.length),
  avoidProvinces: z.array(z.enum(PROVINCES)).max(PROVINCES.length),
});
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;

export const aiSettingsUpdateSchema = aiSettingsSchema
  .partial()
  .refine(
    (v) => !(v.preferredProvinces ?? []).some((p) => (v.avoidProvinces ?? []).includes(p)),
    { message: 'A province cannot be both preferred and avoided', path: ['avoidProvinces'] },
  );
export type AiSettingsUpdateInput = z.infer<typeof aiSettingsUpdateSchema>;

// ── Negotiations (Phase 2) ─────────────────────────────────────────────
export const startNegotiationSchema = z.object({
  loadId: z.uuid(),
  /** Vehicle to negotiate for; defaults to the organization's first vehicle. */
  vehicleId: z.uuid().optional(),
});
export type StartNegotiationInput = z.infer<typeof startNegotiationSchema>;

export const adjustOfferSchema = z.object({
  amount: z.number().positive().max(1_000_000),
});
export type AdjustOfferInput = z.infer<typeof adjustOfferSchema>;

export const negotiationListQuerySchema = z.object({
  /** active = not finished; needs_approval = waiting on the user. */
  filter: z.enum(['active', 'needs_approval', 'all']).default('active'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type NegotiationListQuery = z.infer<typeof negotiationListQuerySchema>;

export const registerDeviceSchema = z.object({
  /** Expo push token (ExponentPushToken[…]). */
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/),
  platform: z.enum(['ios', 'android']),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

// ── Trips (Phase 3) ────────────────────────────────────────────────────
export const tripListQuerySchema = z.object({
  filter: z.enum(['active', 'completed', 'all']).default('active'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type TripListQuery = z.infer<typeof tripListQuerySchema>;

/** Driver progress (the api enforces the lifecycle order). */
export const tripStatusUpdateSchema = z.object({
  status: z.enum(['at_pickup', 'in_transit', 'delivered']),
});
export type TripStatusUpdateInput = z.infer<typeof tripStatusUpdateSchema>;

export const tripLocationsSchema = z.object({
  points: z
    .array(
      z.object({
        lat,
        lng,
        recordedAt: z.coerce.date(),
        speedKmh: z.number().min(0).max(250).optional(),
      }),
    )
    .min(1)
    .max(100),
});
export type TripLocationsInput = z.infer<typeof tripLocationsSchema>;

/** Rate confirmations are generated by the system, not uploaded. */
export const uploadRequestSchema = z.object({
  type: z.enum(DOCUMENT_TYPES).exclude(['rate_confirmation']),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  fileName: z.string().trim().min(1).max(120),
});
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;

export const expenseCreateSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive().max(100_000),
  note: z.string().trim().max(300).optional(),
  incurredAt: z.coerce.date().optional(),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const brokerRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export type BrokerRatingInput = z.infer<typeof brokerRatingSchema>;
