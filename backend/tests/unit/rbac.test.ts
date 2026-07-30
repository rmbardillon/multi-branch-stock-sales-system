import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  requirePermission,
  requireAdmin,
  requireAnyPermission,
} from '../../src/middleware/rbac.middleware';
import {
  checkAccess,
  validateRoleBranchAssignment,
  isBranchScopedRole,
  hasPermission,
  getPermissionsForRole,
  ROLE_PERMISSIONS,
  Permission,
} from '../../src/types/rbac';
import { createUserSchema, updateUserSchema } from '../../src/types/schemas';
import type { Role } from '../../src/types/entities';

// --- Helpers for Express mock ---

function createMockRequest(user?: {
  userId: string;
  username: string;
  role: Role;
  assignedBranchId: string | null;
}, params: Record<string, string> = {}): Partial<Request> {
  return {
    user,
    params,
    query: {},
    body: {},
  };
}

function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// --- checkAccess unit tests ---

describe('checkAccess', () => {
  describe('Admin role', () => {
    it('grants access to any permission', () => {
      expect(checkAccess('Admin', null, 'inventory:read')).toBe(true);
      expect(checkAccess('Admin', null, 'inventory:write')).toBe(true);
      expect(checkAccess('Admin', null, 'sales:create')).toBe(true);
      expect(checkAccess('Admin', null, 'audit:read')).toBe(true);
      expect(checkAccess('Admin', null, 'user:write')).toBe(true);
      expect(checkAccess('Admin', null, 'branch:create')).toBe(true);
    });

    it('grants access regardless of branch scoping', () => {
      expect(checkAccess('Admin', null, 'inventory:read', 'branch-123')).toBe(true);
      expect(checkAccess('Admin', 'branch-abc', 'sales:create', 'branch-xyz')).toBe(true);
    });
  });

  describe('Branch_Manager role', () => {
    const branchId = 'branch-001';

    it('grants access to authorized permissions without branch scope', () => {
      expect(checkAccess('Branch_Manager', branchId, 'inventory:read')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'inventory:write')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'stock_item:read')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'stock_item:write')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'transfer:initiate')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'transfer:approve')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'sales:read')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'report:read')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'report:export')).toBe(true);
      expect(checkAccess('Branch_Manager', branchId, 'dashboard:read')).toBe(true);
    });

    it('denies access to unauthorized permissions', () => {
      expect(checkAccess('Branch_Manager', branchId, 'sales:create')).toBe(false);
      expect(checkAccess('Branch_Manager', branchId, 'branch:create')).toBe(false);
      expect(checkAccess('Branch_Manager', branchId, 'branch:update')).toBe(false);
      expect(checkAccess('Branch_Manager', branchId, 'user:write')).toBe(false);
      expect(checkAccess('Branch_Manager', branchId, 'audit:read')).toBe(false);
    });

    it('grants access when target branch matches assigned branch', () => {
      expect(checkAccess('Branch_Manager', branchId, 'inventory:read', branchId)).toBe(true);
    });

    it('denies access when target branch differs from assigned branch', () => {
      expect(checkAccess('Branch_Manager', branchId, 'inventory:read', 'other-branch')).toBe(false);
      expect(checkAccess('Branch_Manager', branchId, 'transfer:initiate', 'other-branch')).toBe(false);
    });
  });

  describe('Sales_Staff role', () => {
    const branchId = 'branch-002';

    it('grants access to authorized permissions', () => {
      expect(checkAccess('Sales_Staff', branchId, 'sales:create')).toBe(true);
      expect(checkAccess('Sales_Staff', branchId, 'sales:read')).toBe(true);
      expect(checkAccess('Sales_Staff', branchId, 'inventory:read')).toBe(true);
      expect(checkAccess('Sales_Staff', branchId, 'dashboard:read')).toBe(true);
    });

    it('denies access to unauthorized permissions', () => {
      expect(checkAccess('Sales_Staff', branchId, 'inventory:write')).toBe(false);
      expect(checkAccess('Sales_Staff', branchId, 'transfer:initiate')).toBe(false);
      expect(checkAccess('Sales_Staff', branchId, 'report:read')).toBe(false);
      expect(checkAccess('Sales_Staff', branchId, 'branch:create')).toBe(false);
      expect(checkAccess('Sales_Staff', branchId, 'user:write')).toBe(false);
      expect(checkAccess('Sales_Staff', branchId, 'audit:read')).toBe(false);
    });

    it('grants access when target branch matches assigned branch', () => {
      expect(checkAccess('Sales_Staff', branchId, 'sales:create', branchId)).toBe(true);
    });

    it('denies access when target branch differs from assigned branch', () => {
      expect(checkAccess('Sales_Staff', branchId, 'sales:create', 'other-branch')).toBe(false);
    });
  });
});

// --- validateRoleBranchAssignment unit tests ---

describe('validateRoleBranchAssignment', () => {
  it('returns null (valid) for Admin with no branch', () => {
    expect(validateRoleBranchAssignment('Admin', null)).toBeNull();
  });

  it('returns null (valid) for Admin with a branch', () => {
    expect(validateRoleBranchAssignment('Admin', 'branch-123')).toBeNull();
  });

  it('returns null (valid) for Branch_Manager with a branch', () => {
    expect(validateRoleBranchAssignment('Branch_Manager', 'branch-123')).toBeNull();
  });

  it('returns null (valid) for Sales_Staff with a branch', () => {
    expect(validateRoleBranchAssignment('Sales_Staff', 'branch-456')).toBeNull();
  });

  it('returns error for Branch_Manager without a branch', () => {
    const error = validateRoleBranchAssignment('Branch_Manager', null);
    expect(error).not.toBeNull();
    expect(error).toContain('branch must be assigned');
  });

  it('returns error for Sales_Staff without a branch', () => {
    const error = validateRoleBranchAssignment('Sales_Staff', null);
    expect(error).not.toBeNull();
    expect(error).toContain('branch must be assigned');
  });

  it('returns error for Branch_Manager with undefined branch', () => {
    const error = validateRoleBranchAssignment('Branch_Manager', undefined);
    expect(error).not.toBeNull();
  });

  it('returns error for Sales_Staff with undefined branch', () => {
    const error = validateRoleBranchAssignment('Sales_Staff', undefined);
    expect(error).not.toBeNull();
  });
});

// --- isBranchScopedRole unit tests ---

describe('isBranchScopedRole', () => {
  it('returns true for Branch_Manager', () => {
    expect(isBranchScopedRole('Branch_Manager')).toBe(true);
  });

  it('returns true for Sales_Staff', () => {
    expect(isBranchScopedRole('Sales_Staff')).toBe(true);
  });

  it('returns false for Admin', () => {
    expect(isBranchScopedRole('Admin')).toBe(false);
  });
});

// --- hasPermission unit tests ---

describe('hasPermission', () => {
  it('Admin has every permission', () => {
    expect(hasPermission('Admin', 'inventory:read')).toBe(true);
    expect(hasPermission('Admin', 'audit:read')).toBe(true);
    expect(hasPermission('Admin', 'user:write')).toBe(true);
  });

  it('Branch_Manager has inventory permissions', () => {
    expect(hasPermission('Branch_Manager', 'inventory:read')).toBe(true);
    expect(hasPermission('Branch_Manager', 'inventory:write')).toBe(true);
  });

  it('Sales_Staff does not have inventory:write', () => {
    expect(hasPermission('Sales_Staff', 'inventory:write')).toBe(false);
  });
});

// --- getPermissionsForRole unit tests ---

describe('getPermissionsForRole', () => {
  it('returns ["*"] for Admin', () => {
    expect(getPermissionsForRole('Admin')).toEqual(['*']);
  });

  it('returns correct permissions for Branch_Manager', () => {
    const perms = getPermissionsForRole('Branch_Manager');
    expect(perms).toContain('inventory:read');
    expect(perms).toContain('inventory:write');
    expect(perms).toContain('transfer:initiate');
    expect(perms).toContain('report:read');
    expect(perms).not.toContain('sales:create');
    expect(perms).not.toContain('audit:read');
  });

  it('returns correct permissions for Sales_Staff', () => {
    const perms = getPermissionsForRole('Sales_Staff');
    expect(perms).toContain('sales:create');
    expect(perms).toContain('sales:read');
    expect(perms).toContain('inventory:read');
    expect(perms).toContain('dashboard:read');
    expect(perms).not.toContain('inventory:write');
    expect(perms).not.toContain('transfer:initiate');
  });
});

// --- RBAC Middleware unit tests ---

describe('requirePermission middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('returns 401 when no user is set on request', () => {
    const req = createMockRequest(undefined);
    const res = createMockResponse();

    const middleware = requirePermission('inventory:read');
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for Admin requesting any permission', () => {
    const req = createMockRequest({
      userId: 'user-1',
      username: 'admin',
      role: 'Admin',
      assignedBranchId: null,
    });
    const res = createMockResponse();

    const middleware = requirePermission('audit:read');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for Branch_Manager with valid permission and matching branch', () => {
    const req = createMockRequest(
      {
        userId: 'user-2',
        username: 'manager',
        role: 'Branch_Manager',
        assignedBranchId: 'branch-001',
      },
      { branchId: 'branch-001' }
    );
    const res = createMockResponse();

    const middleware = requirePermission('inventory:read', (r) => r.params.branchId);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for Branch_Manager accessing different branch', () => {
    const req = createMockRequest(
      {
        userId: 'user-2',
        username: 'manager',
        role: 'Branch_Manager',
        assignedBranchId: 'branch-001',
      },
      { branchId: 'branch-999' }
    );
    const res = createMockResponse();

    const middleware = requirePermission('inventory:read', (r) => r.params.branchId);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for Sales_Staff without required permission', () => {
    const req = createMockRequest({
      userId: 'user-3',
      username: 'staff',
      role: 'Sales_Staff',
      assignedBranchId: 'branch-001',
    });
    const res = createMockResponse();

    const middleware = requirePermission('inventory:write');
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for Sales_Staff with authorized permission at their branch', () => {
    const req = createMockRequest(
      {
        userId: 'user-3',
        username: 'staff',
        role: 'Sales_Staff',
        assignedBranchId: 'branch-001',
      },
      { branchId: 'branch-001' }
    );
    const res = createMockResponse();

    const middleware = requirePermission('sales:create', (r) => r.params.branchId);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('returns 401 when no user is set on request', () => {
    const req = createMockRequest(undefined);
    const res = createMockResponse();

    const middleware = requireAdmin();
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for Admin user', () => {
    const req = createMockRequest({
      userId: 'user-1',
      username: 'admin',
      role: 'Admin',
      assignedBranchId: null,
    });
    const res = createMockResponse();

    const middleware = requireAdmin();
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for Branch_Manager', () => {
    const req = createMockRequest({
      userId: 'user-2',
      username: 'manager',
      role: 'Branch_Manager',
      assignedBranchId: 'branch-001',
    });
    const res = createMockResponse();

    const middleware = requireAdmin();
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for Sales_Staff', () => {
    const req = createMockRequest({
      userId: 'user-3',
      username: 'staff',
      role: 'Sales_Staff',
      assignedBranchId: 'branch-001',
    });
    const res = createMockResponse();

    const middleware = requireAdmin();
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAnyPermission middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('returns 401 when no user is set', () => {
    const req = createMockRequest(undefined);
    const res = createMockResponse();

    const middleware = requireAnyPermission(['inventory:read', 'sales:read']);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user has at least one of the permissions', () => {
    const req = createMockRequest({
      userId: 'user-3',
      username: 'staff',
      role: 'Sales_Staff',
      assignedBranchId: 'branch-001',
    });
    const res = createMockResponse();

    // Sales_Staff has sales:read but not inventory:write
    const middleware = requireAnyPermission(['inventory:write', 'sales:read']);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user has none of the permissions', () => {
    const req = createMockRequest({
      userId: 'user-3',
      username: 'staff',
      role: 'Sales_Staff',
      assignedBranchId: 'branch-001',
    });
    const res = createMockResponse();

    // Sales_Staff has neither of these
    const middleware = requireAnyPermission(['inventory:write', 'transfer:initiate']);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('enforces branch scoping for requireAnyPermission', () => {
    const req = createMockRequest(
      {
        userId: 'user-3',
        username: 'staff',
        role: 'Sales_Staff',
        assignedBranchId: 'branch-001',
      },
      { branchId: 'branch-999' }
    );
    const res = createMockResponse();

    const middleware = requireAnyPermission(['sales:create', 'sales:read'], (r) => r.params.branchId);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// --- Zod Schema Role-Branch Validation Tests ---

describe('Zod schema role-branch validation (Requirement 8.7)', () => {
  describe('createUserSchema', () => {
    const validBase = {
      username: 'testuser',
      password: 'Password1',
      role: 'Branch_Manager' as Role,
      assigned_branch_id: '123e4567-e89b-12d3-a456-426614174000',
    };

    it('accepts Branch_Manager with assigned branch', () => {
      const result = createUserSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('accepts Sales_Staff with assigned branch', () => {
      const result = createUserSchema.safeParse({
        ...validBase,
        role: 'Sales_Staff',
      });
      expect(result.success).toBe(true);
    });

    it('accepts Admin without assigned branch', () => {
      const result = createUserSchema.safeParse({
        ...validBase,
        role: 'Admin',
        assigned_branch_id: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects Branch_Manager without assigned branch', () => {
      const result = createUserSchema.safeParse({
        ...validBase,
        assigned_branch_id: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('branch must be assigned'))).toBe(true);
      }
    });

    it('rejects Sales_Staff without assigned branch', () => {
      const result = createUserSchema.safeParse({
        ...validBase,
        role: 'Sales_Staff',
        assigned_branch_id: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects Branch_Manager with undefined branch (treated as missing)', () => {
      const input = {
        username: 'testuser',
        password: 'Password1',
        role: 'Branch_Manager',
      };
      const result = createUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateUserSchema', () => {
    it('accepts role change to Branch_Manager with branch provided', () => {
      const result = updateUserSchema.safeParse({
        role: 'Branch_Manager',
        assigned_branch_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects role change to Branch_Manager with null branch', () => {
      const result = updateUserSchema.safeParse({
        role: 'Branch_Manager',
        assigned_branch_id: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects role change to Sales_Staff with null branch', () => {
      const result = updateUserSchema.safeParse({
        role: 'Sales_Staff',
        assigned_branch_id: null,
      });
      expect(result.success).toBe(false);
    });

    it('accepts Admin role with no branch', () => {
      const result = updateUserSchema.safeParse({
        role: 'Admin',
        assigned_branch_id: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts update without role change (no branch restriction needed)', () => {
      const result = updateUserSchema.safeParse({
        username: 'newname',
      });
      expect(result.success).toBe(true);
    });
  });
});
