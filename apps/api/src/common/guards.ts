import { apiError } from './api-error';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { can, ROLES, type Permission } from '@dispatcher/shared';
import type { Request } from 'express';
import type { AccessTokenPayload, AuthContext } from './auth-context';
import { IS_PUBLIC_KEY, PERMISSION_KEY } from './decorators';

type AuthedRequest = Request & { auth?: AuthContext };

/** Global guard: every route needs a valid bearer token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token)
      throw new UnauthorizedException(
        apiError('AUTH_TOKEN_MISSING', 'Missing bearer token'),
      );

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(
        apiError('AUTH_TOKEN_INVALID', 'Invalid or expired token'),
      );
    }
    if (!ROLES.includes(payload.role))
      throw new UnauthorizedException(
        apiError('AUTH_TOKEN_INVALID', 'Invalid token claims'),
      );

    request.auth = {
      userId: payload.sub,
      organizationId: payload.org,
      role: payload.role,
    };
    return true;
  }
}

/** Global guard: enforces @RequirePermission() using the shared RBAC matrix. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;

    const { auth } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!can(auth?.role, permission))
      throw new ForbiddenException(
        apiError('FORBIDDEN', `Missing permission: ${permission}`),
      );
    return true;
  }
}
