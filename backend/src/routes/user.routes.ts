import { Router, Request, Response } from 'express';
import { createUserSchema, updateUserSchema } from '../types/schemas';
import { userService, UserServiceError } from '../services/user.service';
import { requireAdmin } from '../middleware/rbac.middleware';
import { auditLog } from '../services/audit.service';
import type { Role } from '../types/entities';

const router = Router();

/**
 * GET /api/users
 * List all users (excluding password_hash).
 * Admin only.
 */
router.get('/', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.list();
    res.status(200).json({ data: users });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while listing users',
    });
  }
});

/**
 * POST /api/users
 * Create a new user.
 * Admin only.
 */
router.post('/', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid user data',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const user = await userService.create(parseResult.data);

    // Log audit trail
    auditLog(
      req.user!.userId,
      user.assigned_branch_id || req.user!.assignedBranchId || null,
      'user_created',
      `User "${user.username}" created with role ${user.role}`,
      {
        created_user_id: user.id,
        username: user.username,
        role: user.role,
        assigned_branch_id: user.assigned_branch_id,
      }
    );

    res.status(201).json({ data: user });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 409 ? 'Conflict' : error.statusCode === 422 ? 'Unprocessable entity' : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the user',
    });
  }
});

/**
 * GET /api/users/:id
 * Get a single user by ID.
 * Admin only.
 */
router.get('/:id', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userService.getById(id);
    res.status(200).json({ data: user });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 404 ? 'Not found' : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the user',
    });
  }
});

/**
 * PUT /api/users/:id
 * Update a user.
 * Admin only.
 */
router.put('/:id', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const parseResult = updateUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid user data',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const user = await userService.update(id, parseResult.data);

    // Log audit trail
    auditLog(
      req.user!.userId,
      user.assigned_branch_id || req.user!.assignedBranchId || null,
      'user_updated',
      `User "${user.username}" updated`,
      {
        updated_user_id: user.id,
        username: user.username,
        changes: Object.keys(parseResult.data),
      }
    );

    res.status(200).json({ data: user });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 409 ? 'Conflict'
          : error.statusCode === 422 ? 'Unprocessable entity'
          : error.statusCode === 404 ? 'Not found'
          : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating the user',
    });
  }
});

/**
 * PUT /api/users/:id/role
 * Assign a role to a user.
 * Admin only.
 * Body: { role: Role, assigned_branch_id?: string | null }
 */
router.put('/:id/role', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, assigned_branch_id } = req.body;

    // Validate role
    const validRoles: Role[] = ['Admin', 'Branch_Manager', 'Sales_Staff'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid role. Must be one of: Admin, Branch_Manager, Sales_Staff',
      });
      return;
    }

    const user = await userService.assignRole(id, role as Role, assigned_branch_id);

    // Log audit trail
    auditLog(
      req.user!.userId,
      user.assigned_branch_id || req.user!.assignedBranchId || null,
      'user_updated',
      `User "${user.username}" role changed to ${role}`,
      {
        updated_user_id: user.id,
        username: user.username,
        new_role: role,
        assigned_branch_id: user.assigned_branch_id,
      }
    );

    res.status(200).json({ data: user });
  } catch (error) {
    if (error instanceof UserServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 422 ? 'Unprocessable entity'
          : error.statusCode === 404 ? 'Not found'
          : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while assigning the role',
    });
  }
});

export default router;
