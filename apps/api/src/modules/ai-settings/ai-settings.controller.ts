import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  aiSettingsUpdateSchema,
  type AiSettingsUpdateInput,
} from '@dispatcher/shared';
import { Auth, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { AiSettingsService } from './ai-settings.service';

@ApiTags('ai-settings')
@ApiBearerAuth()
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  @RequirePermission('loads:read')
  get(@Auth() auth: AuthContext) {
    return this.settings.get(auth.organizationId);
  }

  @Patch()
  @RequirePermission('ai_settings:manage')
  update(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(aiSettingsUpdateSchema))
    body: AiSettingsUpdateInput,
  ) {
    return this.settings.update(auth.organizationId, body);
  }
}
