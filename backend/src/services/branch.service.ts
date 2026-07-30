import { query } from '../database/connection';
import type { Branch, BranchStatus } from '../types/entities';
import type { CreateBranchDto, UpdateBranchDto } from '../types/dtos';

export interface BranchFilters {
  status?: BranchStatus;
  search?: string;
}

export class BranchServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'BranchServiceError';
    this.statusCode = statusCode;
  }
}

export class BranchService {
  /**
   * Create a new branch.
   * Enforces unique name constraint (409 on conflict).
   */
  async create(data: CreateBranchDto): Promise<Branch> {
    // Check for duplicate name
    const existing = await query(
      'SELECT id FROM branches WHERE LOWER(name) = LOWER($1)',
      [data.name]
    );

    if (existing.rows.length > 0) {
      throw new BranchServiceError(
        'A branch with this name already exists',
        409
      );
    }

    const result = await query(
      `INSERT INTO branches (name, address, contact_number, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.address, data.contact_number, data.status]
    );

    return result.rows[0] as Branch;
  }

  /**
   * Update an existing branch.
   * Enforces unique name constraint on name change (409 on conflict).
   */
  async update(id: string, data: UpdateBranchDto): Promise<Branch> {
    // Verify branch exists
    const existing = await query('SELECT * FROM branches WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      throw new BranchServiceError('Branch not found', 404);
    }

    // If name is being changed, check for uniqueness
    if (data.name) {
      const duplicate = await query(
        'SELECT id FROM branches WHERE LOWER(name) = LOWER($1) AND id != $2',
        [data.name, id]
      );

      if (duplicate.rows.length > 0) {
        throw new BranchServiceError(
          'A branch with this name already exists',
          409
        );
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(data.address);
    }
    if (data.contact_number !== undefined) {
      updates.push(`contact_number = $${paramIndex++}`);
      values.push(data.contact_number);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (updates.length === 0) {
      // Nothing to update, return existing branch
      return existing.rows[0] as Branch;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE branches SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] as Branch;
  }

  /**
   * Deactivate a branch.
   * Checks for pending transactions (sales/transfers) and warns if any exist.
   * Returns the updated branch and pending transaction counts.
   */
  async deactivate(id: string): Promise<{ branch: Branch; pendingWarning?: { sales: number; transfers: number } }> {
    // Verify branch exists
    const existing = await query('SELECT * FROM branches WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      throw new BranchServiceError('Branch not found', 404);
    }

    const branch = existing.rows[0] as Branch;

    if (branch.status === 'Inactive') {
      throw new BranchServiceError('Branch is already inactive', 400);
    }

    // Check for pending transfers involving this branch
    const pendingTransfers = await query(
      `SELECT COUNT(*) as count FROM stock_transfers 
       WHERE (source_branch_id = $1 OR destination_branch_id = $1) 
       AND status = 'pending'`,
      [id]
    );

    const pendingTransferCount = parseInt(pendingTransfers.rows[0].count, 10);

    // Check for today's sales at this branch (as a proxy for "pending" sales)
    // Since sale transactions are instant in our system, we check recent ones
    const pendingSales = await query(
      `SELECT COUNT(*) as count FROM sale_transactions 
       WHERE branch_id = $1 
       AND transaction_date >= NOW() - INTERVAL '1 day'`,
      [id]
    );

    const pendingSaleCount = parseInt(pendingSales.rows[0].count, 10);

    // Perform the deactivation
    const result = await query(
      `UPDATE branches SET status = 'Inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    const updatedBranch = result.rows[0] as Branch;

    if (pendingTransferCount > 0 || pendingSaleCount > 0) {
      return {
        branch: updatedBranch,
        pendingWarning: {
          sales: pendingSaleCount,
          transfers: pendingTransferCount,
        },
      };
    }

    return { branch: updatedBranch };
  }

  /**
   * List all branches with optional filtering.
   * Supports status filter and search (case-insensitive, partial match on name/address).
   */
  async list(filters?: BranchFilters): Promise<Branch[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters?.search) {
      conditions.push(
        `(LOWER(name) LIKE $${paramIndex} OR LOWER(address) LIKE $${paramIndex})`
      );
      values.push(`%${filters.search.toLowerCase()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM branches ${whereClause} ORDER BY name ASC`,
      values
    );

    return result.rows as Branch[];
  }

  /**
   * Get a single branch by ID.
   * Throws 404 if not found.
   */
  async getById(id: string): Promise<Branch> {
    const result = await query('SELECT * FROM branches WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new BranchServiceError('Branch not found', 404);
    }

    return result.rows[0] as Branch;
  }
}

export const branchService = new BranchService();
