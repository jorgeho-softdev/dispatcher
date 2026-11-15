import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  vehicleCreateSchema,
  vehicleUpdateSchema,
  type VehicleCreateInput,
  type VehicleUpdateInput,
} from '@dispatcher/shared';
import { Auth, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @RequirePermission('vehicles:read')
  list(@Auth() auth: AuthContext) {
    return this.vehicles.list(auth.organizationId);
  }

  @Get(':id')
  @RequirePermission('vehicles:read')
  get(@Auth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.get(auth.organizationId, id);
  }

  @Post()
  @RequirePermission('vehicles:manage')
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(vehicleCreateSchema)) body: VehicleCreateInput,
  ) {
    return this.vehicles.create(auth.organizationId, body);
  }

  @Patch(':id')
  @RequirePermission('vehicles:manage')
  update(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(vehicleUpdateSchema)) body: VehicleUpdateInput,
  ) {
    return this.vehicles.update(auth.organizationId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('vehicles:manage')
  async remove(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.vehicles.remove(auth.organizationId, id);
  }
}
