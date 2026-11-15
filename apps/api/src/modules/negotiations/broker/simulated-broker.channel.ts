import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Queue } from 'bullmq';
import { roundRate } from '@dispatcher/shared';
import type { Env } from '../../../config/env';
import { JOB_OPTIONS, NEGOTIATIONS_QUEUE } from '../negotiations.queue';
import type {
  BrokerChannel,
  BrokerNegotiationRef,
  BrokerResponse,
} from './broker-channel';

/**
 * A fake broker for the MVP (clearly a simulation — loads are flagged DEMO).
 * Behaviour is deterministic per load: each load has a hidden maximum
 * 3–11 % above its posted rate. Replies arrive after BROKER_SIM_DELAY_MS.
 */
@Injectable()
export class SimulatedBrokerChannel implements BrokerChannel {
  readonly name = 'simulated';
  private readonly delay: number;

  constructor(
    @InjectQueue(NEGOTIATIONS_QUEUE) private readonly queue: Queue,
    config: ConfigService<Env, true>,
  ) {
    this.delay = config.get('BROKER_SIM_DELAY_MS', { infer: true });
  }

  /** Hidden max rate the broker would pay for this load. */
  static brokerMax(loadId: string, postedRate: number): number {
    const h = createHash('sha256').update(loadId).digest().readUInt32BE(0);
    return roundRate(postedRate * (1 + (3 + (h % 9)) / 100));
  }

  static respondToOffer(
    ref: BrokerNegotiationRef,
    amount: number,
  ): BrokerResponse {
    const max = SimulatedBrokerChannel.brokerMax(ref.loadId, ref.postedRate);
    if (amount <= max) {
      return {
        kind: 'offer',
        type: 'accept',
        amount,
        message: `Deal at ${amount}. Sending the rate confirmation.`,
      };
    }
    if (amount > ref.postedRate * 1.25) {
      return {
        kind: 'offer',
        type: 'reject',
        message: "That's well above what the shipper pays. We'll pass.",
      };
    }
    // Meets halfway, never above its max; final offer from round 3.
    const counter = Math.min(
      max,
      roundRate(ref.postedRate + (amount - ref.postedRate) * 0.5),
    );
    return {
      kind: 'offer',
      type: 'counter',
      amount: ref.round >= 3 ? max : Math.max(ref.postedRate, counter),
      message:
        ref.round >= 3
          ? `Best I can do is ${max}.`
          : `Can you do ${Math.max(ref.postedRate, counter)}?`,
    };
  }

  async sendOffer(ref: BrokerNegotiationRef, amount: number): Promise<void> {
    await this.reply(
      ref.id,
      SimulatedBrokerChannel.respondToOffer(ref, amount),
    );
  }

  async requestBooking(ref: BrokerNegotiationRef): Promise<void> {
    await this.reply(ref.id, {
      kind: 'booking',
      type: 'confirm',
      message: 'Booked. Rate confirmation to follow.',
    });
  }

  private async reply(negotiationId: string, response: BrokerResponse) {
    await this.queue.add(
      'broker-response',
      { negotiationId, response },
      { ...JOB_OPTIONS, delay: this.delay },
    );
  }
}
