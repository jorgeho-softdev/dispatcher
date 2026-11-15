import type {
  AutonomyLevel,
  Currency,
  EquipmentType,
  ErrorCode,
  LoadSource,
  LoadStatus,
  Role,
} from './constants';

// API response shapes (JSON over the wire: dates are ISO strings, money is a
// number in the load's currency).

export interface UserDto {
  id: string;
  name: string;
  email: string;
  /** Preferred language (a Locale from @dispatcher/i18n). */
  locale: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  country: string;
}

export interface MeDto {
  user: UserDto;
  organization: OrganizationDto;
  role: Role;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface AuthResponseDto extends AuthTokensDto {
  me: MeDto;
}

export interface VehicleDto {
  id: string;
  name: string;
  equipment: EquipmentType;
  plate: string | null;
  capacityKg: number;
  costPerKm: number;
  homeBaseCity: string | null;
  homeBaseProvince: string | null;
  createdAt: string;
}

export interface BrokerDto {
  id: string;
  name: string;
  ratingAvg: number | null;
}

export interface LoadDto {
  id: string;
  source: LoadSource;
  isSimulated: boolean;
  status: LoadStatus;
  originCity: string;
  originProvince: string;
  destinationCity: string;
  destinationProvince: string;
  pickupAt: string;
  distanceKm: number;
  weightKg: number;
  equipment: EquipmentType;
  postedRate: number;
  currency: Currency;
  broker: BrokerDto | null;
  /** Estimate for the caller's first matching vehicle; null without one. */
  estimatedProfit: number | null;
  ratePerKm: number;
}

export interface AiSettingsDto {
  autonomyLevel: AutonomyLevel;
  minRatePerKm: number;
  minMarginPct: number;
  maxCounterOfferPct: number;
  maxDeadheadKm: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorDto {
  statusCode: number;
  /** Stable code for clients to translate (see ERROR_CODES). */
  code: ErrorCode;
  /** Developer-facing English description; never shown to users as-is. */
  message: string;
  issues?: { path: string; message: string }[];
}
