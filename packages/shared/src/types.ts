import type {
  AutonomyLevel,
  Currency,
  EquipmentType,
  ErrorCode,
  LoadSource,
  LoadStatus,
  Role,
} from './constants';
import type { MatchReasonItem } from './matching';

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
  homeBaseLat: number | null;
  homeBaseLng: number | null;
  lastLocationAt: string | null;
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
  ratePerKm: number;
  /** Empty km from the matched vehicle's position to the pickup (road estimate); null if unknown. */
  deadheadKm: number | null;
  /** Profit after loaded + deadhead km costs for the matched vehicle; null without a vehicle. */
  estimatedProfit: number | null;
  marginPct: number | null;
  /** Match against the vehicle; null when the organization has no vehicle. */
  match: { score: number; compatible: boolean; reasons: MatchReasonItem[] } | null;
}

/** Where the position used for deadhead came from. */
export type PositionSource = 'request' | 'vehicle_gps' | 'home_base' | null;

export interface MatchContextDto {
  vehicle: Pick<VehicleDto, 'id' | 'name' | 'equipment' | 'costPerKm'> | null;
  positionSource: PositionSource;
}

export interface LoadListDto extends Paginated<LoadDto> {
  context: MatchContextDto;
}

export interface LoadDetailDto extends LoadDto {
  notes: string | null;
  context: MatchContextDto;
  /** Cost/profit breakdown shown in the load detail screen. */
  breakdown: {
    loadedKm: number;
    deadheadKm: number;
    totalKm: number;
    costPerKm: number;
    costs: number;
    profit: number;
    marginPct: number;
  } | null;
}

export interface AiSettingsDto {
  autonomyLevel: AutonomyLevel;
  minRatePerKm: number;
  minMarginPct: number;
  maxCounterOfferPct: number;
  maxDeadheadKm: number;
  preferredProvinces: string[];
  avoidProvinces: string[];
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
