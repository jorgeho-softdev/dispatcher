import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NegotiationsService } from './negotiations.service';
import { NEGOTIATIONS_QUEUE, type NegotiationJob } from './negotiations.queue';

/** BullMQ worker: runs the asynchronous steps of each negotiation. */
@Processor(NEGOTIATIONS_QUEUE)
export class NegotiationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NegotiationsProcessor.name);

  constructor(private readonly negotiations: NegotiationsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { name, data } = job as unknown as NegotiationJob;
    this.logger.debug(`${name} ${data.negotiationId}`);
    switch (name) {
      case 'ai-propose':
        return this.negotiations.runOpening(data.negotiationId);
      case 'ai-respond':
        return this.negotiations.runResponse(data.negotiationId);
      case 'broker-response':
        return this.negotiations.handleBrokerResponse(
          data.negotiationId,
          data.response,
        );
    }
  }
}
