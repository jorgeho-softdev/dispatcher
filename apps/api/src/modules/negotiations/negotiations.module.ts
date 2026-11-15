import { BullModule } from '@nestjs/bullmq';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { LoadsModule } from '../loads/loads.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BROKER_CHANNEL } from './broker/broker-channel';
import { SimulatedBrokerChannel } from './broker/simulated-broker.channel';
import { ClaudeStrategy } from './strategy/claude.strategy';
import {
  FALLBACK_STRATEGY,
  NEGOTIATION_STRATEGY,
} from './strategy/negotiation-strategy';
import { RulesStrategy } from './strategy/rules.strategy';
import { NegotiationsController } from './negotiations.controller';
import { NegotiationsProcessor } from './negotiations.processor';
import { NegotiationsService } from './negotiations.service';
import { NEGOTIATIONS_QUEUE } from './negotiations.queue';

@Module({
  imports: [
    BullModule.registerQueue({ name: NEGOTIATIONS_QUEUE }),
    LoadsModule,
    NotificationsModule,
  ],
  controllers: [NegotiationsController],
  providers: [
    NegotiationsService,
    NegotiationsProcessor,
    RulesStrategy,
    { provide: FALLBACK_STRATEGY, useExisting: RulesStrategy },
    {
      // AI_STRATEGY=auto picks Claude only when Anthropic credentials are configured.
      provide: NEGOTIATION_STRATEGY,
      inject: [ConfigService, RulesStrategy],
      useFactory: (config: ConfigService<Env, true>, rules: RulesStrategy) => {
        const mode = config.get('AI_STRATEGY', { infer: true });
        const hasKey = Boolean(
          config.get('ANTHROPIC_API_KEY', { infer: true }),
        );
        const useClaude = mode === 'claude' || (mode === 'auto' && hasKey);
        Logger.log(
          `Negotiation strategy: ${useClaude ? 'claude' : 'rules'}`,
          'NegotiationsModule',
        );
        return useClaude ? new ClaudeStrategy(config) : rules;
      },
    },
    { provide: BROKER_CHANNEL, useClass: SimulatedBrokerChannel },
  ],
})
export class NegotiationsModule {}
