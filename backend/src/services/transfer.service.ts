import { withTransaction, query } from '../database/connection';
import type { StockTransfer, TransferLineItem, TransferStatus } from '../types/entities';
import type { CreateTransferDto } from '../types/dtos';

export interface TransferLineItemWithDetails extends TransferLineItem {
  stock_item_name?: string;
  stock_item_sku?: string;
}

export interface StockTransferWithLineItems extends StockTransfer {
  line_items: TransferLineItemWithDetails[];
}

export interface InsufficientTransferStockDetail {
  stock_item_id: string;
  requested_quantity: number;
  available_quantity: number;
}

export interface TransferFilters {
  status?: TransferStatus;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTransfers {
  transfers: StockTransferWithLineItems[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class TransferServiceError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'TransferServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class TransferService {
  /**
   * Initiate a stock transfer.
   *
   * Validates:
   * - Source branch != destination branch
   * - User is assigned to source branch (or is Admin)
   * - Max 50 line items
   * - Each line item quantity is between 1 and 10000
   *
   * Creates a transfer record with status 'pending' and inserts line items.
   */
  async initiate(
    userId: string,
    data: CreateTransferDto
  ): Promise<StockTransferWithLineItems> {
    // Validate source != destination
    if (data.source_branch_id === data.destination_branch_id) {
      throw new TransferServiceError(
        'Source and destination branches must be different',
        400
      );
    }

    // Validate line items exist
    if (!data.line_items || data.line_items.length === 0) {
      throw new TransferServiceError(
        'At least one line item is required',
        400
      );
    }

    // Validate max 50 line items
    if (data.line_items.length > 50) {
      throw new TransferServiceError(
        'A transfer may not exceed 50 line items',
        400
      );
    }

    // Validate each line item quantity (1-10000)
    for (const item of data.line_items) {
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10000
      ) {
        throw new TransferServiceError(
          `Quantity must be an integer between 1 and 10000 for item ${item.stock_item_id}`,
          400
        );
      }
    }

    // Check user is assigned to the source branch or is Admin
    const userResult = await query(
      'SELECT id, role, assigned_branch_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new TransferServiceError('User not found', 404);
    }

    const user = userResult.rows[0];

    if (user.role !== 'Admin' && user.assigned_branch_id !== data.source_branch_id) {
      throw new TransferServiceError(
        'You can only initiate transfers from your assigned branch',
        403
      );
    }

    // Verify source branch exists
    const sourceBranchResult = await query(
      'SELECT id, status FROM branches WHERE id = $1',
      [data.source_branch_id]
    );

    if (sourceBranchResult.rows.length === 0) {
      throw new TransferServiceError('Source branch not found', 404);
    }

    // Verify destination branch exists
    const destBranchResult = await query(
      'SELECT id, status FROM branches WHERE id = $1',
      [data.destination_branch_id]
    );

    if (destBranchResult.rows.length === 0) {
      throw new TransferServiceError('Destination branch not found', 404);
    }

    // Create transfer record and line items within a transaction
    return withTransaction(async (client) => {
      // Insert transfer record with status 'pending'
      const transferResult = await client.query(
        `INSERT INTO stock_transfers (source_branch_id, destination_branch_id, initiated_by, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [data.source_branch_id, data.destination_branch_id, userId]
      );

      const transfer = transferResult.rows[0] as StockTransfer;

      // Insert transfer line items
      const insertedLineItems: TransferLineItemWithDetails[] = [];

      for (const item of data.line_items) {
        const lineResult = await client.query(
          `INSERT INTO transfer_line_items (stock_transfer_id, stock_item_id, quantity)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [transfer.id, item.stock_item_id, item.quantity]
        );

        insertedLineItems.push(lineResult.rows[0] as TransferLineItemWithDetails);
      }

      return {
        ...transfer,
        line_items: insertedLineItems,
      };
    });
  }

  /**
   * Confirm a stock transfer with atomic stock level changes.
   *
   * Within a PostgreSQL transaction:
   * 1. Lock the transfer record
   * 2. Verify status is 'pending'
   * 3. SELECT ... FOR UPDATE on stock_levels at both source and destination
   * 4. Validate sufficient stock at source for all items
   * 5. Deduct from source
   * 6. Add to destination (INSERT ... ON CONFLICT for new stock rows)
   * 7. Set status to 'confirmed', set confirmed_at
   *
   * On insufficient stock: set status to 'failed', throw error.
   * On system error: ROLLBACK preserves original stock levels, set status to 'failed'.
   */
  async confirm(
    transferId: string,
    userId: string
  ): Promise<StockTransferWithLineItems> {
    try {
      return await withTransaction(async (client) => {
        // 1. Lock and fetch the transfer record
        const transferResult = await client.query(
          `SELECT * FROM stock_transfers WHERE id = $1 FOR UPDATE`,
          [transferId]
        );

        if (transferResult.rows.length === 0) {
          throw new TransferServiceError('Transfer not found', 404);
        }

        const transfer = transferResult.rows[0] as StockTransfer;

        // 2. Verify status is 'pending'
        if (transfer.status !== 'pending') {
          throw new TransferServiceError(
            `Transfer cannot be confirmed — current status is '${transfer.status}'`,
            422
          );
        }

        // 3. Fetch line items
        const lineItemsResult = await client.query(
          `SELECT * FROM transfer_line_items WHERE stock_transfer_id = $1`,
          [transferId]
        );

        const lineItems = lineItemsResult.rows as TransferLineItem[];

        if (lineItems.length === 0) {
          throw new TransferServiceError(
            'Transfer has no line items',
            422
          );
        }

        const stockItemIds = lineItems.map((li) => li.stock_item_id);

        // 4. Lock stock level rows at SOURCE branch with SELECT ... FOR UPDATE
        const sourceStockResult = await client.query(
          `SELECT stock_item_id, quantity
           FROM stock_levels
           WHERE branch_id = $1 AND stock_item_id = ANY($2)
           FOR UPDATE`,
          [transfer.source_branch_id, stockItemIds]
        );

        // 5. Lock stock level rows at DESTINATION branch with SELECT ... FOR UPDATE
        await client.query(
          `SELECT stock_item_id, quantity
           FROM stock_levels
           WHERE branch_id = $1 AND stock_item_id = ANY($2)
           FOR UPDATE`,
          [transfer.destination_branch_id, stockItemIds]
        );

        // Build map of available source stock
        const sourceStock = new Map<string, number>();
        for (const row of sourceStockResult.rows) {
          sourceStock.set(row.stock_item_id, row.quantity);
        }

        // 6. Validate all items have sufficient stock at source
        const insufficientItems: InsufficientTransferStockDetail[] = [];

        for (const item of lineItems) {
          const available = sourceStock.get(item.stock_item_id) ?? 0;
          if (available < item.quantity) {
            insufficientItems.push({
              stock_item_id: item.stock_item_id,
              requested_quantity: item.quantity,
              available_quantity: available,
            });
          }
        }

        if (insufficientItems.length > 0) {
          // Set status to 'failed' before throwing
          await client.query(
            `UPDATE stock_transfers SET status = 'failed' WHERE id = $1`,
            [transferId]
          );

          throw new TransferServiceError(
            'Insufficient stock at source branch for one or more items',
            422,
            { insufficient_items: insufficientItems }
          );
        }

        // 7. Deduct from source stock_levels
        for (const item of lineItems) {
          await client.query(
            `UPDATE stock_levels
             SET quantity = quantity - $1, last_updated = NOW()
             WHERE branch_id = $2 AND stock_item_id = $3`,
            [item.quantity, transfer.source_branch_id, item.stock_item_id]
          );
        }

        // 8. Add to destination stock_levels (INSERT ... ON CONFLICT)
        for (const item of lineItems) {
          await client.query(
            `INSERT INTO stock_levels (branch_id, stock_item_id, quantity, last_updated)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (branch_id, stock_item_id)
             DO UPDATE SET quantity = stock_levels.quantity + $3, last_updated = NOW()`,
            [transfer.destination_branch_id, item.stock_item_id, item.quantity]
          );
        }

        // 9. Set transfer status to 'confirmed' and confirmed_at
        const updatedTransferResult = await client.query(
          `UPDATE stock_transfers
           SET status = 'confirmed', confirmed_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [transferId]
        );

        const confirmedTransfer = updatedTransferResult.rows[0] as StockTransfer;

        // Fetch line items with details for the response
        const detailedLineItemsResult = await client.query(
          `SELECT tli.*, si.name AS stock_item_name, si.sku AS stock_item_sku
           FROM transfer_line_items tli
           JOIN stock_items si ON tli.stock_item_id = si.id
           WHERE tli.stock_transfer_id = $1`,
          [transferId]
        );

        return {
          ...confirmedTransfer,
          line_items: detailedLineItemsResult.rows as TransferLineItemWithDetails[],
        };
      });
    } catch (error) {
      // If it's already a TransferServiceError, re-throw it
      if (error instanceof TransferServiceError) {
        throw error;
      }

      // On unexpected system error, mark the transfer as 'failed' outside the rolled-back transaction
      try {
        await query(
          `UPDATE stock_transfers SET status = 'failed' WHERE id = $1 AND status = 'pending'`,
          [transferId]
        );
      } catch {
        // If even this fails, we still throw the original error
      }

      throw new TransferServiceError(
        'Transfer failed due to a system error. Stock levels have been preserved.',
        500,
        { originalError: (error as Error).message }
      );
    }
  }

  /**
   * Get transfers for a branch (source or destination) with optional filtering and pagination.
   * Includes line items with stock item details.
   */
  async getTransfers(
    branchId: string,
    filters?: TransferFilters
  ): Promise<PaginatedTransfers> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    // Build query conditions — include transfers where branch is source OR destination
    const conditions: string[] = [
      '(st.source_branch_id = $1 OR st.destination_branch_id = $1)',
    ];
    const values: unknown[] = [branchId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`st.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM stock_transfers st WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated transfers
    const transfersResult = await query(
      `SELECT st.*,
              sb.name AS source_branch_name,
              db.name AS destination_branch_name
       FROM stock_transfers st
       LEFT JOIN branches sb ON st.source_branch_id = sb.id
       LEFT JOIN branches db ON st.destination_branch_id = db.id
       WHERE ${whereClause}
       ORDER BY st.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, pageSize, offset]
    );

    const transfers: StockTransferWithLineItems[] = [];

    // Fetch line items with stock item details for each transfer
    for (const txn of transfersResult.rows) {
      const lineItemsResult = await query(
        `SELECT tli.*, si.name AS stock_item_name, si.sku AS stock_item_sku
         FROM transfer_line_items tli
         JOIN stock_items si ON tli.stock_item_id = si.id
         WHERE tli.stock_transfer_id = $1
         ORDER BY si.name ASC`,
        [txn.id]
      );

      transfers.push({
        ...txn,
        line_items: lineItemsResult.rows as TransferLineItemWithDetails[],
      });
    }

    return {
      transfers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const transferService = new TransferService();
