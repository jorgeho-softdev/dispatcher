import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Permission } from '@dispatcher/shared';
import type { AuthContext } from './auth-context';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opts a route out of the global JwtAuthGuard. Every other route requires a token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSION_KEY = 'permission';
/** Checked by PermissionsGuard against ROLE_PERMISSIONS from @dispatcher/shared. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);

/** The authenticated user, organization and role for this request. */
export const Auth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<{ auth: AuthContext }>();
    return request.auth;
  },
);
