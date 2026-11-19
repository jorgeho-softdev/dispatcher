/**
 * How the agent talks to a broker. Phase 2 ships SimulatedBrokerChannel;
 * email (Phase 5) and load-board booking APIs implement the same contract.
 * Replies arrive asynchronously as `broker-response` jobs.
 */
export interface BrokerChannel {
  readonly name: string;
  sendOffer(
    n: BrokerNegotiationRef,
    amount: number,
    message: string,
  ): Promise<void>;
  requestBooking(n: BrokerNegotiationRef, rate: number): Promise<void>;
}

export interface BrokerNegotiationRef {
  id: string;
  loadId: string;
  postedRate: number;
  /** Offer round being sent (1-based). */
  round: number;
}

export type BrokerResponse =
  | { kind: 'offer'; type: 'accept'; amount: number; message: string }
  | { kind: 'offer'; type: 'counter'; amount: number; message: string }
  | { kind: 'offer'; type: 'reject'; message: string }
  | { kind: 'booking'; type: 'confirm'; message: string }
  | { kind: 'booking'; type: 'decline'; message: string };

export const BROKER_CHANNEL = Symbol('BROKER_CHANNEL');
