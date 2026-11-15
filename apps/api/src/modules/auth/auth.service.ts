import { apiError } from '../../common/api-error';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@dispatcher/i18n';
import type {
  AuthResponseDto,
  AuthTokensDto,
  LoginInput,
  MeDto,
  RegisterInput,
  UpdateMeInput,
} from '@dispatcher/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccessTokenPayload,
  AuthContext,
} from '../../common/auth-context';
import type { Env } from '../../config/env';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Creates the user, their organization (as owner) and default AI settings. */
  async register(input: RegisterInput): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing)
      throw new ConflictException(
        apiError('AUTH_EMAIL_TAKEN', 'Email already registered'),
      );

    const passwordHash = await hash(input.password);
    const { user, membership } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          locale: this.toLocale(input.locale),
        },
      });
      const organization = await tx.organization.create({
        data: { name: input.companyName, aiSettings: { create: {} } },
      });
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'owner',
        },
      });
      return { user, membership };
    });

    const { response } = await this.issue({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role,
    });
    return response;
  }

  async login(input: LoginInput): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    // Same error for unknown email and wrong password: no account enumeration.
    if (!user || !(await verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException(
        apiError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password'),
      );
    }
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership)
      throw new UnauthorizedException(
        apiError('AUTH_INVALID_CREDENTIALS', 'User has no organization'),
      );

    const { response } = await this.issue({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role,
    });
    return response;
  }

  /** Rotates the refresh token. Reuse of an already-rotated token revokes its whole family. */
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!stored)
      throw new UnauthorizedException(
        apiError('AUTH_REFRESH_INVALID', 'Invalid refresh token'),
      );

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException(
        apiError('AUTH_REFRESH_REUSED', 'Refresh token reuse detected'),
      );
    }
    if (stored.expiresAt < new Date())
      throw new UnauthorizedException(
        apiError('AUTH_REFRESH_INVALID', 'Refresh token expired'),
      );

    // Atomic claim: if two requests race with the same token only one wins.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException(
        apiError('AUTH_REFRESH_REUSED', 'Refresh token reuse detected'),
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: { userId: stored.userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership)
      throw new UnauthorizedException(
        apiError('AUTH_INVALID_CREDENTIALS', 'User has no organization'),
      );

    const { response, refreshTokenId } = await this.issue(
      {
        userId: stored.userId,
        organizationId: membership.organizationId,
        role: membership.role,
      },
      stored.familyId,
    );
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { replacedBy: refreshTokenId },
    });
    return response;
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  async me(auth: AuthContext): Promise<MeDto> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: auth.userId,
          organizationId: auth.organizationId,
        },
      },
      include: { user: true, organization: true },
    });
    if (!membership)
      throw new NotFoundException(
        apiError('NOT_FOUND', 'Membership not found'),
      );
    return {
      user: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        locale: this.toLocale(membership.user.locale),
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        country: membership.organization.country,
      },
      role: membership.role,
    };
  }

  /** Saves the user's preferred language (used for push/email in later phases). */
  async updateMe(auth: AuthContext, input: UpdateMeInput): Promise<MeDto> {
    if (!isLocale(input.locale)) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', `Unsupported locale: ${input.locale}`),
      );
    }
    await this.prisma.user.update({
      where: { id: auth.userId },
      data: { locale: input.locale },
    });
    return this.me(auth);
  }

  private toLocale(value: string | null | undefined): Locale {
    return isLocale(value) ? value : DEFAULT_LOCALE;
  }

  private async issue(
    ctx: AuthContext,
    familyId: string = randomUUID(),
  ): Promise<{ response: AuthResponseDto; refreshTokenId: string }> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', {
      infer: true,
    });
    const payload: AccessTokenPayload = {
      sub: ctx.userId,
      org: ctx.organizationId,
      role: ctx.role,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const record = await this.prisma.refreshToken.create({
      data: {
        userId: ctx.userId,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    const tokens: AuthTokensDto = { accessToken, refreshToken, expiresIn };
    return {
      response: { ...tokens, me: await this.me(ctx) },
      refreshTokenId: record.id,
    };
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
