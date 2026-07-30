import { query } from '../database/connection';
import type { User, Role } from '../types/entities';
import type { CreateUserDto, UpdateUserDto } from '../types/dtos';
import { validateRoleBranchAssignment } from '../types/rbac';
import { AuthService } from './auth.service';

/**
 * User object returned from the service (excludes password_hash).
 */
export interface UserResponse {
  id: string;
  username: string;
  role: Role;
  assigned_branch_id: string | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_activity: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class UserServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UserServiceError';
    this.statusCode = statusCode;
  }
}

export class UserService {
  /**
   * List all users (excluding password_hash).
   */
  async list(): Promise<UserResponse[]> {
    const result = await query(
      `SELECT id, username, role, assigned_branch_id, failed_login_attempts,
              locked_until, last_activity, is_active, created_at, updated_at
       FROM users
       ORDER BY username ASC`
    );

    return result.rows as UserResponse[];
  }

  /**
   * Get a single user by ID (excluding password_hash).
   * Throws 404 if not found.
   */
  async getById(id: string): Promise<UserResponse> {
    const result = await query(
      `SELECT id, username, role, assigned_branch_id, failed_login_attempts,
              locked_until, last_activity, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new UserServiceError('User not found', 404);
    }

    return result.rows[0] as UserResponse;
  }

  /**
   * Create a new user with hashed password.
   * Validates branch assignment for branch-scoped roles.
   * Enforces unique username constraint.
   */
  async create(data: CreateUserDto): Promise<UserResponse> {
    // Validate role-branch assignment
    const branchError = validateRoleBranchAssignment(data.role, data.assigned_branch_id);
    if (branchError) {
      throw new UserServiceError(branchError, 422);
    }

    // If a branch is specified, verify it exists
    if (data.assigned_branch_id) {
      const branchResult = await query(
        'SELECT id FROM branches WHERE id = $1',
        [data.assigned_branch_id]
      );
      if (branchResult.rows.length === 0) {
        throw new UserServiceError('Assigned branch not found', 404);
      }
    }

    // Check for duplicate username
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [data.username]
    );

    if (existing.rows.length > 0) {
      throw new UserServiceError('A user with this username already exists', 409);
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(data.password);

    const result = await query(
      `INSERT INTO users (username, password_hash, role, assigned_branch_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, assigned_branch_id, failed_login_attempts,
                 locked_until, last_activity, is_active, created_at, updated_at`,
      [data.username, passwordHash, data.role, data.assigned_branch_id || null]
    );

    return result.rows[0] as UserResponse;
  }

  /**
   * Update user fields.
   * Validates branch assignment on role change.
   * If password is provided, it is hashed before storing.
   */
  async update(id: string, data: UpdateUserDto): Promise<UserResponse> {
    // Verify user exists
    const existing = await query('SELECT * FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      throw new UserServiceError('User not found', 404);
    }

    const currentUser = existing.rows[0] as User;

    // Determine effective role and branch for validation
    const effectiveRole = data.role ?? currentUser.role;
    const effectiveBranch = data.assigned_branch_id !== undefined
      ? data.assigned_branch_id
      : currentUser.assigned_branch_id;

    // Validate role-branch assignment if role or branch is changing
    if (data.role !== undefined || data.assigned_branch_id !== undefined) {
      const branchError = validateRoleBranchAssignment(effectiveRole as Role, effectiveBranch);
      if (branchError) {
        throw new UserServiceError(branchError, 422);
      }
    }

    // If a branch is specified, verify it exists
    if (data.assigned_branch_id) {
      const branchResult = await query(
        'SELECT id FROM branches WHERE id = $1',
        [data.assigned_branch_id]
      );
      if (branchResult.rows.length === 0) {
        throw new UserServiceError('Assigned branch not found', 404);
      }
    }

    // Check username uniqueness if being changed
    if (data.username) {
      const duplicate = await query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
        [data.username, id]
      );
      if (duplicate.rows.length > 0) {
        throw new UserServiceError('A user with this username already exists', 409);
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.password !== undefined) {
      const passwordHash = await AuthService.hashPassword(data.password);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }
    if (data.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.assigned_branch_id !== undefined) {
      updates.push(`assigned_branch_id = $${paramIndex++}`);
      values.push(data.assigned_branch_id);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      // Nothing to update, return existing user
      return this.getById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, username, role, assigned_branch_id, failed_login_attempts,
                 locked_until, last_activity, is_active, created_at, updated_at`,
      values
    );

    return result.rows[0] as UserResponse;
  }

  /**
   * Assign a role to a user.
   * Validates that branch-scoped roles require branch assignment.
   * If branchId is provided, updates both role and branch assignment atomically.
   * Role change takes immediate effect (user's next action uses new permissions).
   */
  async assignRole(id: string, role: Role, branchId?: string | null): Promise<UserResponse> {
    // Verify user exists
    const existing = await query('SELECT * FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      throw new UserServiceError('User not found', 404);
    }

    const currentUser = existing.rows[0] as User;

    // Determine the effective branch: use provided branchId, or fall back to current
    const effectiveBranch = branchId !== undefined ? branchId : currentUser.assigned_branch_id;

    // Validate role-branch assignment
    const branchError = validateRoleBranchAssignment(role, effectiveBranch);
    if (branchError) {
      throw new UserServiceError(branchError, 422);
    }

    // If a new branch is specified, verify it exists
    if (branchId) {
      const branchResult = await query(
        'SELECT id FROM branches WHERE id = $1',
        [branchId]
      );
      if (branchResult.rows.length === 0) {
        throw new UserServiceError('Assigned branch not found', 404);
      }
    }

    // Update role (and optionally branch) - immediate effect
    const updates = ['role = $1', 'updated_at = NOW()'];
    const values: unknown[] = [role];
    let paramIndex = 2;

    if (branchId !== undefined) {
      updates.push(`assigned_branch_id = $${paramIndex++}`);
      values.push(branchId);
    }

    values.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, username, role, assigned_branch_id, failed_login_attempts,
                 locked_until, last_activity, is_active, created_at, updated_at`,
      values
    );

    return result.rows[0] as UserResponse;
  }
}

export const userService = new UserService();
