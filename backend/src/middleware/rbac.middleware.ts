import { Request, Response, NextFunction } from 'express';
import { Permission, ROLE_PERMISSIONS, checkAccess } from '../types/rbac';
import type { Role } from '../types/entities';

/**
 * RBAC middleware factory.
 * Creates Express middleware that checks if the authenticated user
 * has the required permission, optionally scoped to a specific branch.
 *
 * @param permission - The required permission (e.g., 'inventory:write')
 * @param getBranchId - Optional function to extract the target branch ID from the request.
 *                      If provided, non-Admin users must be assigned to that branch.
 */
export function requirePermission(
  permission: Permission,
  getBranchId?: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    const targetBranchId = getBranchId ? getBranchId(req) : undefined;

    const hasAccess = checkAccess(
      user.role as Role,
      user.assignedBranchId,
      permission,
      targetBranchId
    );

    if (!hasAccess) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to perform this action',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that requires the user to be an Admin.
 */
export function requireAdmin() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    if (user.role !== 'Admin') {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Admin access required',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that requires the user to have any of the specified permissions.
 */
export function requireAnyPermission(
  permissions: Permission[],
  getBranchId?: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    const targetBranchId = getBranchId ? getBranchId(req) : undefined;

    const hasAnyAccess = permissions.some((perm) =>
      checkAccess(user.role as Role, user.assignedBranchId, perm, targetBranchId)
    );

    if (!hasAnyAccess) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to perform this action',
      });
      return;
    }

    next();
  };
}
