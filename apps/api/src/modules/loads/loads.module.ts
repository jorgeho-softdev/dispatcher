import { Module } from '@nestjs/common';
import { LoadsController } from './loads.controller';
import { LoadsService } from './loads.service';
import { MatchingContextService } from './matching-context.service';

@Module({
  controllers: [LoadsController],
  providers: [LoadsService, MatchingContextService],
  exports: [MatchingContextService],
})
export class LoadsModule {}
