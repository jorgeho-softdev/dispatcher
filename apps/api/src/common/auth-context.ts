import type { Role } from '@dispatcher/shared';

/** Claims carried by the access token and attached to every request. */
export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  role: Role;
}
