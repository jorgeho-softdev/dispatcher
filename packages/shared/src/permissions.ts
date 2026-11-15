import type { Role } from './constants';

// RBAC lives here so the api enforces exactly the same rules that web and
// mobile use to show or hide UI. Add a permission here first, then use it
// with @RequirePermission() in the api and can() in the clients.
export const PERMISSIONS = [
  'organization:manage',
  'members:manage',
  'vehicles:read',
  'vehicles:manage',
  /** Drivers report their GPS position (deadhead / near me). */
  'vehicles:report_location',
  'loads:read',
  'loads:create',
  'loads:book',
  'ai_settings:manage',
  'finances:read',
  'trips:read',
  'trips:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL,
  fleet_manager: [
    'members:manage',
    'vehicles:read',
    'vehicles:manage',
    'vehicles:report_location',
    'loads:read',
    'loads:create',
    'loads:book',
    'ai_settings:manage',
    'finances:read',
    'trips:read',
    'trips:manage',
  ],
  dispatcher: ['vehicles:read', 'vehicles:report_location', 'loads:read', 'loads:create', 'loads:book', 'trips:read', 'trips:manage'],
  // Driver booking approval is configurable per organization in a later phase.
  driver: ['vehicles:read', 'vehicles:report_location', 'loads:read', 'trips:read'],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
