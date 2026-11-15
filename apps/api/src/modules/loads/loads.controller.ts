import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  loadCreateSchema,
  loadDetailQuerySchema,
  loadQuerySchema,
  type LoadCreateInput,
  type LoadDetailQuery,
  type LoadQuery,
} from '@dispatcher/shared';
import { Auth, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { LoadsService } from './loads.service';

@ApiTags('loads')
@ApiBearerAuth()
@Controller('loads')
export class LoadsController {
  constructor(private readonly loads: LoadsService) {}

  @Get()
  @RequirePermission('loads:read')
  list(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(loadQuerySchema)) query: LoadQuery,
  ) {
    return this.loads.list(auth.organizationId, query);
  }

  @Get(':id')
  @RequirePermission('loads:read')
  get(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(loadDetailQuerySchema)) query: LoadDetailQuery,
  ) {
    return this.loads.get(auth.organizationId, id, query);
  }

  @Post()
  @RequirePermission('loads:create')
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(loadCreateSchema)) body: LoadCreateInput,
  ) {
    return this.loads.createManual(auth.organizationId, body);
  }
}
