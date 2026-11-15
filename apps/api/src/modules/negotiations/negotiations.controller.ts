import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adjustOfferSchema,
  negotiationListQuerySchema,
  startNegotiationSchema,
  type AdjustOfferInput,
  type NegotiationListQuery,
  type StartNegotiationInput,
} from '@dispatcher/shared';
import { Auth, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { NegotiationsService } from './negotiations.service';

@ApiTags('negotiations')
@ApiBearerAuth()
@Controller('negotiations')
export class NegotiationsController {
  constructor(private readonly negotiations: NegotiationsService) {}

  @Post()
  @RequirePermission('loads:book')
  start(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(startNegotiationSchema))
    body: StartNegotiationInput,
  ) {
    return this.negotiations.start(auth, body);
  }

  @Get()
  @RequirePermission('loads:read')
  list(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(negotiationListQuerySchema))
    query: NegotiationListQuery,
  ) {
    return this.negotiations.list(auth.organizationId, query);
  }

  @Get(':id')
  @RequirePermission('loads:read')
  get(@Auth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.negotiations.getDetail(auth.organizationId, id);
  }

  @Post(':id/approve-send')
  @HttpCode(200)
  @RequirePermission('loads:book')
  approveSend(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.negotiations.approveSend(auth, id);
  }

  @Post(':id/adjust')
  @HttpCode(200)
  @RequirePermission('loads:book')
  adjust(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adjustOfferSchema)) body: AdjustOfferInput,
  ) {
    return this.negotiations.adjustOffer(auth, id, body);
  }

  @Post(':id/approve-booking')
  @HttpCode(200)
  @RequirePermission('loads:book')
  approveBooking(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.negotiations.approveBooking(auth, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('loads:book')
  cancel(@Auth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.negotiations.cancel(auth, id);
  }
}
