import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateMeSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type UpdateMeInput,
} from '@dispatcher/shared';
import { Auth, Public } from '../../common/decorators';
import { AuthRateLimit } from '../../common/auth-rate-limit';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @AuthRateLimit()
  @Post('auth/register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Public()
  @AuthRateLimit()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput) {
    await this.auth.logout(body.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@Auth() auth: AuthContext) {
    return this.auth.me(auth);
  }

  @ApiBearerAuth()
  @Patch('me')
  updateMe(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ) {
    return this.auth.updateMe(auth, body);
  }
}
