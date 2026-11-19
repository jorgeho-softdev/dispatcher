// Single source of truth for every enum-like value in the domain.
// The Prisma schema mirrors these values; web and mobile render them.

/** Product name shown to users (app, web, PDFs, API docs). Single source: change it here. */
export const BRAND_NAME = 'HaulGenius';

export const ROLES = ['owner', 'fleet_manager', 'dispatcher', 'driver'] as const;
export type Role = (typeof ROLES)[number];

export const EQUIPMENT_TYPES = [
  'cargo_van',
  'sprinter',
  'box_truck',
  'dry_van',
  'reefer',
  'flatbed',
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const LOAD_SOURCES = [
  'simulated',
  'manual',
  'loadlink',
  'dat',
  'truckstop',
  'loadboard_123',
  'broker_direct',
] as const;
export type LoadSource = (typeof LOAD_SOURCES)[number];

/** Load list views (tabs in the mockup: Recomendadas / Cerca de mí / Todas). */
export const LOAD_VIEWS = ['recommended', 'nearby', 'all'] as const;
export type LoadView = (typeof LOAD_VIEWS)[number];

export const LOAD_STATUSES = ['available', 'negotiating', 'booked', 'expired', 'cancelled'] as const;
export type LoadStatus = (typeof LOAD_STATUSES)[number];

export const CURRENCIES = ['CAD', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DISTANCE_UNITS = ['km', 'mi'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const COUNTRIES = ['CA', 'US'] as const;
export type Country = (typeof COUNTRIES)[number];

export const AUTONOMY_LEVELS = ['assisted', 'semi_auto', 'auto'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const DEFAULTS = {
  currency: 'CAD',
  distanceUnit: 'km',
  country: 'CA',
} as const satisfies { currency: Currency; distanceUnit: DistanceUnit; country: Country };

/**
 * Stable machine-readable error codes returned by the api in `code`.
 * Clients translate them (packages/i18n → `errors.<CODE>`); the api never
 * sends user-facing translated text. Add a code here + in every catalog.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_TAKEN',
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_REFRESH_INVALID',
  'AUTH_REFRESH_REUSED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VEHICLE_REQUIRED',
  'LOAD_UNAVAILABLE',
  'NEGOTIATION_ALREADY_ACTIVE',
  'NEGOTIATION_INVALID_STATE',
  'TRIP_INVALID_STATE',
  'POD_REQUIRED',
  'UPLOAD_NOT_FOUND',
  'BROKER_ALREADY_RATED',
  'INVITATION_INVALID',
  'LAST_OWNER',
  'CANNOT_CHANGE_SELF',
  'API_UNAVAILABLE',
  'NETWORK_ERROR',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Normalizes any api/BFF error body `code` into a known ErrorCode. */
export function toErrorCode(value: unknown): ErrorCode {
  return isErrorCode(value) ? value : 'INTERNAL_ERROR';
}
