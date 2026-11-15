import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission, Role } from '@dispatcher/shared';
import { PermissionsGuard } from './guards';

function contextFor(role: Role | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        auth: role && { userId: 'u', organizationId: 'o', role },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const requires = (p: Permission | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(p);

  afterEach(() => jest.restoreAllMocks());

  it('allows routes without a required permission', () => {
    requires(undefined);
    expect(guard.canActivate(contextFor('driver'))).toBe(true);
  });

  it('allows an owner to manage vehicles', () => {
    requires('vehicles:manage');
    expect(guard.canActivate(contextFor('owner'))).toBe(true);
  });

  it('forbids a driver from managing vehicles', () => {
    requires('vehicles:manage');
    expect(() => guard.canActivate(contextFor('driver'))).toThrow(
      ForbiddenException,
    );
  });

  it('forbids requests without auth context', () => {
    requires('loads:read');
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
