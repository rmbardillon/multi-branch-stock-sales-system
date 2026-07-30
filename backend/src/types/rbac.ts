// RBAC (Role-Based Access Control) types and permission matrix

import type { Role } from './entities';

export type Permission =
  | 'inventory:read'
  | 'inventory:write'
  | 'stock_item:read'
  | 'stock_item:write'
  | 'transfer:initiate'
  | 'transfer:approve'
  | 'sales:create'
  | 'sales:read'
  | 'report:read'
  | 'report:export'
  | 'dashboard:read'
  | 'branch:create'
  | 'branch:update'
  | 'branch:deactivate'
  | 'user:read'
  | 'user:write'
  | 'user:assign_role'
  | 'audit:read'
  | '*';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: ['*'],
  Branch_Manager: [
    'inventory:read',
    'inventory:write',
    'stock_item:read',
    'stock_item:write',
    'transfer:initiate',
    'transfer:approve',
    'sales:read',
    'report:read',
    'report:export',
    'dashboard:read',
  ],
  Sales_Staff: [
    'sales:create',
    'sales:read',
    'inventory:read',
    'dashboard:read',
  ],
};

/**
 * Check if a user has the required permission, optionally scoped to a branch.
 */
export function checkAccess(
  userRole: Role,
  userBranchId: string | null,
  permission: Permission,
  targetBranchId?: string
): boolean {
  if (userRole === 'Admin') return true;

  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions.includes(permission)) return false;

  if (targetBranchId && userBranchId !== targetBranchId) return false;

  return true;
}

/**
 * Validate that a role assignment is valid with respect to branch assignment.
 * Branch-scoped roles (Branch_Manager, Sales_Staff) require a non-null assigned_branch_id.
 *
 * @returns null if valid, or an error message string if invalid.
 */
export function validateRoleBranchAssignment(
  role: Role,
  assignedBranchId: string | null | undefined
): string | null {
  const branchScopedRoles: Role[] = ['Branch_Manager', 'Sales_Staff'];

  if (branchScopedRoles.includes(role) && !assignedBranchId) {
    return `A branch must be assigned when role is ${role}`;
  }

  return null;
}

/**
 * Check if a role is branch-scoped (requires branch assignment).
 */
export function isBranchScopedRole(role: Role): boolean {
  return role === 'Branch_Manager' || role === 'Sales_Staff';
}

/**
 * Get the list of permissions for a given role.
 * Returns ['*'] for Admin (meaning all permissions).
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a given role has a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === 'Admin') return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
