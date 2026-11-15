import type {
  EquipmentType,
  LoadCreateInput,
  LoadSource,
} from '@dispatcher/shared';

/**
 * Contract every load source implements (simulated, manual, Loadlink, DAT…).
 * The rest of the system only sees NormalizedLoad, so adding a provider never
 * touches matching, negotiation or the clients. See docs/adr/0005-load-provider-adapters.md.
 */
export interface LoadProvider {
  readonly source: LoadSource;
  readonly capabilities: {
    canBook: boolean;
    canNegotiate: boolean;
  };
  search(criteria: LoadSearchCriteria): Promise<NormalizedLoad[]>;
}

export interface LoadSearchCriteria {
  equipment?: EquipmentType[];
  originProvinces?: string[];
  pickupFrom?: Date;
  pickupTo?: Date;
  limit?: number;
}

export interface NormalizedLoad extends LoadCreateInput {
  source: LoadSource;
  externalId: string;
  isSimulated: boolean;
  broker?: { name: string; email?: string; phone?: string };
  rawPayload?: unknown;
}
