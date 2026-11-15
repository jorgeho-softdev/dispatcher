import type { BrokerResponse } from './broker/broker-channel';

export const NEGOTIATIONS_QUEUE = 'negotiations';

/** Background jobs of the negotiation workflow (BullMQ). All handlers are idempotent. */
export type NegotiationJob =
  | { name: 'ai-propose'; data: { negotiationId: string } }
  | { name: 'ai-respond'; data: { negotiationId: string } }
  | {
      name: 'broker-response';
      data: { negotiationId: string; response: BrokerResponse };
    };

export const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} as const;
