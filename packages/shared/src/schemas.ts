import { z } from 'zod';
import { AUTONOMY_LEVELS, CURRENCIES, EQUIPMENT_TYPES, LOAD_SOURCES, LOAD_STATUSES } from './constants';

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
  homeBaseProvince: z.string().trim().length(2).optional(),
});
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = vehicleCreateSchema.partial();
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;

export const loadQuerySchema = z.object({
  equipment: z.enum(EQUIPMENT_TYPES).optional(),
  originProvince: z.string().length(2).optional(),
  status: z.enum(LOAD_STATUSES).optional(),
  includeSimulated: z.stringbool().default(true),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type LoadQuery = z.infer<typeof loadQuerySchema>;

export const loadCreateSchema = z.object({
  originCity: z.string().trim().min(1),
  originProvince: z.string().trim().length(2),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destinationCity: z.string().trim().min(1),
  destinationProvince: z.string().trim().length(2),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  pickupAt: z.coerce.date(),
  distanceKm: z.number().positive(),
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
  minRatePerKm: z.number().positive(),
  minMarginPct: z.number().min(0).max(100),
  maxCounterOfferPct: z.number().min(0).max(100),
  maxDeadheadKm: z.number().int().min(0),
});
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
