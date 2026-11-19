import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  registerDeviceSchema,
  type RegisterDeviceInput,
} from '@dispatcher/shared';
import { Auth } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { PrismaService } from '../../prisma/prisma.service';

/** Registers the phone's Expo push token for the signed-in user. */
@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  async register(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(registerDeviceSchema))
    body: RegisterDeviceInput,
  ) {
    // A token moves to whoever signed in last on that phone.
    await this.prisma.deviceToken.upsert({
      where: { token: body.token },
      create: {
        token: body.token,
        platform: body.platform,
        userId: auth.userId,
      },
      update: {
        userId: auth.userId,
        platform: body.platform,
        lastSeenAt: new Date(),
      },
    });
  }

  @Delete(':token')
  @HttpCode(204)
  async unregister(@Auth() auth: AuthContext, @Param('token') token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { token, userId: auth.userId },
    });
  }
}
