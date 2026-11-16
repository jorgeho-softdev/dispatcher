import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  brokerRatingSchema,
  expenseCreateSchema,
  tripListQuerySchema,
  tripLocationsSchema,
  tripDriverSchema,
  tripStatusUpdateSchema,
  uploadRequestSchema,
  type BrokerRatingInput,
  type ExpenseCreateInput,
  type TripListQuery,
  type TripLocationsInput,
  type TripDriverInput,
  type TripStatusUpdateInput,
  type UploadRequestInput,
} from '@dispatcher/shared';
import { Auth, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { TripsService } from './trips.service';

@ApiTags('trips')
@ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get('trips')
  @RequirePermission('trips:read')
  list(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(tripListQuerySchema)) query: TripListQuery,
  ) {
    return this.trips.list(auth, query);
  }

  @Get('fleet/live')
  @RequirePermission('trips:read')
  liveMap(@Auth() auth: AuthContext) {
    return this.trips.liveMap(auth);
  }

  @Post('trips/:id/driver')
  @HttpCode(200)
  @RequirePermission('trips:manage')
  assignDriver(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(tripDriverSchema)) body: TripDriverInput,
  ) {
    return this.trips.assignDriver(auth, id, body);
  }

  @Get('trips/:id')
  @RequirePermission('trips:read')
  get(@Auth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.get(auth, id);
  }

  @Post('trips/:id/status')
  @HttpCode(200)
  @RequirePermission('trips:progress')
  updateStatus(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(tripStatusUpdateSchema))
    body: TripStatusUpdateInput,
  ) {
    return this.trips.updateStatus(auth, id, body);
  }

  @Post('trips/:id/locations')
  @HttpCode(200)
  @RequirePermission('trips:progress')
  recordLocations(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(tripLocationsSchema)) body: TripLocationsInput,
  ) {
    return this.trips.recordLocations(auth, id, body);
  }

  @Post('trips/:id/documents/upload-url')
  @RequirePermission('trips:progress')
  requestUpload(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(uploadRequestSchema)) body: UploadRequestInput,
  ) {
    return this.trips.requestUpload(auth, id, body);
  }

  @Post('trips/:id/documents/:documentId/complete')
  @HttpCode(200)
  @RequirePermission('trips:progress')
  completeUpload(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.trips.completeUpload(auth, id, documentId);
  }

  @Get('documents/:id/download-url')
  @RequirePermission('trips:read')
  downloadUrl(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.downloadUrl(auth, id);
  }

  @Post('trips/:id/expenses')
  @RequirePermission('trips:progress')
  addExpense(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(expenseCreateSchema)) body: ExpenseCreateInput,
  ) {
    return this.trips.addExpense(auth, id, body);
  }

  @Delete('trips/:id/expenses/:expenseId')
  @RequirePermission('trips:progress')
  deleteExpense(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return this.trips.deleteExpense(auth, id, expenseId);
  }

  @Post('trips/:id/complete')
  @HttpCode(200)
  @RequirePermission('trips:manage')
  complete(@Auth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.complete(auth, id);
  }

  @Post('trips/:id/cancel')
  @HttpCode(200)
  @RequirePermission('trips:manage')
  cancel(@Auth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.cancel(auth, id);
  }

  @Post('trips/:id/broker-rating')
  @HttpCode(200)
  @RequirePermission('trips:manage')
  rateBroker(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(brokerRatingSchema)) body: BrokerRatingInput,
  ) {
    return this.trips.rateBroker(auth, id, body);
  }
}
