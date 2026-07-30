/**
 * Property-Based Tests: RBAC Enforcement
 *
 * Feature: multi-branch-stock-sales-system
 * Property 23: Role-Permission Enforcement
 * Property 24: Single Role Invariant
 * Property 25: Branch-Scoped Role Requires Branch Assignment
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { arbRole, arbUuid, defaultPropertyConfig } from '../factories/arbitraries';
import {
  checkAccess,
  ROLE_PERMISSIONS,
  validateRoleBranchAssignment,
  Permission,
} from '../../src/types/rbac';
import { createUserSchema } from '../../src/types/schemas';
import type { Role } from '../../src/types/entities';

// ---------- Custom Arbitraries ----------

/** All concrete permissions (excluding wildcard '*') */
const ALL_PERMISSIONS: Permission[] = [
  'inventory:read',
  'inventory:write',
  'stock_item:read',
  'stock_item:write',
  'transfer:initiate',
  'transfer:approve',
  'sales:create',
  'sales:read',
  'report:read',
  'report:export',
  'dashboard:read',
  'branch:create',
  'branch:update',
  'branch:deactivate',
  'user:read',
  'user:write',
  'user:assign_role',
  'audit:read',
];

/** Generate a random concrete permission (not '*') */
const arbPermission: fc.Arbitrary<Permission> = fc.constantFrom(...ALL_PERMISSIONS);

/** Generate a branch-scoped role (Branch_Manager or Sales_Staff) */
const arbBranchScopedRole: fc.Arbitrary<Role> = fc.constantFrom('Branch_Manager', 'Sales_Staff');

// ---------- Property 23: Role-Permission Enforcement ----------

describe('Property 23: Role-Permission Enforcement', () => {
  it('checkAccess grants access iff: role is Admin OR (permission is in role permissions AND (no targetBranch OR targetBranch matches userBranch))', () => {
    fc.assert(
      fc.property(
        arbRole,
        arbUuid,
        arbPermission,
        fc.option(arbUuid, { nil: undefined }),
        (role, userBranchId, permission, targetBranchId) => {
          const result = checkAccess(role, userBranchId, permission, targetBranchId);

          // Compute expected result based on the specification
          let expected: boolean;

          if (role === 'Admin') {
            // Admin always has access regardless of permission or branch
            expected = true;
          } else {
            // Non-admin: permission must be in role's permission set
            const rolePermissions = ROLE_PERMISSIONS[role];
            const hasPermission = rolePermissions.includes(permission);

            if (!hasPermission) {
              expected = false;
            } else if (targetBranchId && userBranchId !== targetBranchId) {
              // Branch mismatch: deny
              expected = false;
            } else {
              expected = true;
            }
          }

          expect(result).toBe(expected);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('Admin is always granted access regardless of permission and branch', () => {
    fc.assert(
      fc.property(
        arbUuid,
        arbPermission,
        fc.option(arbUuid, { nil: undefined }),
        (userBranchId, permission, targetBranchId) => {
          const result = checkAccess('Admin', userBranchId, permission, targetBranchId);
          expect(result).toBe(true);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('non-Admin roles are denied access when permission is not in their set', () => {
    fc.assert(
      fc.property(
        arbBranchScopedRole,
        arbUuid,
        arbPermission,
        (role, userBranchId, permission) => {
          const rolePermissions = ROLE_PERMISSIONS[role];
          if (!rolePermissions.includes(permission)) {
            const result = checkAccess(role, userBranchId, permission);
            expect(result).toBe(false);
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('non-Admin roles are denied access when target branch differs from user branch', () => {
    fc.assert(
      fc.property(
        arbBranchScopedRole,
        arbUuid,
        arbUuid,
        arbPermission,
        (role, userBranchId, targetBranchId, permission) => {
          // Ensure branches are different
          fc.pre(userBranchId !== targetBranchId);

          const rolePermissions = ROLE_PERMISSIONS[role];
          if (rolePermissions.includes(permission)) {
            const result = checkAccess(role, userBranchId, permission, targetBranchId);
            expect(result).toBe(false);
          }
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 24: Single Role Invariant ----------

describe('Property 24: Single Role Invariant', () => {
  const VALID_ROLES: Role[] = ['Admin', 'Branch_Manager', 'Sales_Staff'];

  it('any generated role is always exactly one of {Admin, Branch_Manager, Sales_Staff}', () => {
    fc.assert(
      fc.property(arbRole, (role) => {
        expect(VALID_ROLES).toContain(role);
        // It is exactly one — the value is a single string, not an array
        expect(typeof role).toBe('string');
        // Verify it matches exactly one from the set
        const matchCount = VALID_ROLES.filter((r) => r === role).length;
        expect(matchCount).toBe(1);
      }),
      defaultPropertyConfig
    );
  });

  it('createUserSchema rejects any role not in the valid set', () => {
    // Generate strings that are NOT valid roles
    const arbInvalidRole = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !VALID_ROLES.includes(s as Role));

    fc.assert(
      fc.property(arbInvalidRole, arbUuid, (invalidRole, branchId) => {
        const input = {
          username: 'testuser',
          password: 'Password1',
          role: invalidRole,
          assigned_branch_id: branchId,
        };

        const result = createUserSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      defaultPropertyConfig
    );
  });

  it('createUserSchema accepts all valid roles with proper data', () => {
    fc.assert(
      fc.property(arbRole, arbUuid, (role, branchId) => {
        const input = {
          username: 'testuser',
          password: 'Password1',
          role,
          // Admin can have null branch; others need a branch
          assigned_branch_id: role === 'Admin' ? null : branchId,
        };

        const result = createUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 25: Branch-Scoped Role Requires Branch Assignment ----------

describe('Property 25: Branch-Scoped Role Requires Branch Assignment', () => {
  it('validateRoleBranchAssignment rejects Branch_Manager or Sales_Staff with null/undefined branch', () => {
    const arbNullishBranch: fc.Arbitrary<null | undefined> = fc.constantFrom(null, undefined);

    fc.assert(
      fc.property(arbBranchScopedRole, arbNullishBranch, (role, branchId) => {
        const result = validateRoleBranchAssignment(role, branchId);
        // Should return a non-null error message
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        expect(result!.length).toBeGreaterThan(0);
      }),
      defaultPropertyConfig
    );
  });

  it('validateRoleBranchAssignment accepts Admin with null branch', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined) as fc.Arbitrary<null | undefined>,
        (branchId) => {
          const result = validateRoleBranchAssignment('Admin', branchId);
          expect(result).toBeNull();
        }
      ),
      defaultPropertyConfig
    );
  });

  it('validateRoleBranchAssignment accepts any role with a valid branch assigned', () => {
    fc.assert(
      fc.property(arbRole, arbUuid, (role, branchId) => {
        const result = validateRoleBranchAssignment(role, branchId);
        expect(result).toBeNull();
      }),
      defaultPropertyConfig
    );
  });

  it('createUserSchema rejects Branch_Manager or Sales_Staff with null assigned_branch_id', () => {
    fc.assert(
      fc.property(arbBranchScopedRole, (role) => {
        const input = {
          username: 'testuser',
          password: 'Password1',
          role,
          assigned_branch_id: null,
        };

        const result = createUserSchema.safeParse(input);
        expect(result.success).toBe(false);

        if (!result.success) {
          const messages = result.error.issues.map((i) => i.message);
          expect(messages.some((m) => m.toLowerCase().includes('branch must be assigned'))).toBe(true);
        }
      }),
      defaultPropertyConfig
    );
  });

  it('createUserSchema rejects Branch_Manager or Sales_Staff with missing assigned_branch_id', () => {
    fc.assert(
      fc.property(arbBranchScopedRole, (role) => {
        const input = {
          username: 'testuser',
          password: 'Password1',
          role,
          // assigned_branch_id is omitted (undefined)
        };

        const result = createUserSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      defaultPropertyConfig
    );
  });

  it('createUserSchema accepts Admin with null assigned_branch_id', () => {
    fc.assert(
      fc.property(fc.constant('Admin' as Role), (role) => {
        const input = {
          username: 'testuser',
          password: 'Password1',
          role,
          assigned_branch_id: null,
        };

        const result = createUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      defaultPropertyConfig
    );
  });
});
