import { withTransaction, query } from '../database/connection';
import type { SaleTransaction, SaleLineItem } from '../types/entities';
import type { CreateSaleDto } from '../types/dtos';

export interface SaleTransactionWithLineItems extends SaleTransaction {
  line_items: SaleLineItemWithDetails[];
}

export interface SaleLineItemWithDetails extends SaleLineItem {
  stock_item_name?: string;
  stock_item_sku?: string;
}

export interface InsufficientStockDetail {
  stock_item_id: string;
  requested_quantity: number;
  available_quantity: number;
}

export interface SaleFilters {
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSales {
  transactions: SaleTransactionWithLineItems[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class SalesServiceError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'SalesServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class SalesService {
  /**
   * Create a sale transaction with atomic stock deduction.
   * Uses SELECT ... FOR UPDATE to prevent concurrent overselling.
   *
   * Validates:
   * - Branch exists and is Active
   * - At least 1 line item
   * - All quantities >= 1
   * - All requested stock is available
   *
   * On insufficient stock, the entire transaction is rejected (ROLLBACK).
   */
  async createTransaction(
    userId: string,
    data: CreateSaleDto
  ): Promise<SaleTransactionWithLineItems> {
    // Validate minimum line items
    if (!data.line_items || data.line_items.length === 0) {
      throw new SalesServiceError(
        'At least one line item is required',
        400
      );
    }

    // Validate line item quantities
    for (const item of data.line_items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new SalesServiceError(
          `Quantity must be an integer >= 1 for item ${item.stock_item_id}`,
          400
        );
      }
    }

    return withTransaction(async (client) => {
      // 1. Verify branch exists and is Active
      const branchResult = await client.query(
        'SELECT id, status FROM branches WHERE id = $1',
        [data.branch_id]
      );

      if (branchResult.rows.length === 0) {
        throw new SalesServiceError('Branch not found', 404);
      }

      if (branchResult.rows[0].status !== 'Active') {
        throw new SalesServiceError(
          'Cannot create sales at an inactive branch',
          422
        );
      }

      // 2. Get all stock item IDs from line items
      const stockItemIds = data.line_items.map((item) => item.stock_item_id);

      // 3. Lock stock level rows with SELECT ... FOR UPDATE
      const stockLevelsResult = await client.query(
        `SELECT sl.stock_item_id, sl.quantity
         FROM stock_levels sl
         WHERE sl.branch_id = $1 AND sl.stock_item_id = ANY($2)
         FOR UPDATE`,
        [data.branch_id, stockItemIds]
      );

      // Build a map of available stock
      const availableStock = new Map<string, number>();
      for (const row of stockLevelsResult.rows) {
        availableStock.set(row.stock_item_id, row.quantity);
      }

      // 4. Validate all line items have sufficient stock
      const insufficientItems: InsufficientStockDetail[] = [];

      for (const item of data.line_items) {
        const available = availableStock.get(item.stock_item_id) ?? 0;
        if (available < item.quantity) {
          insufficientItems.push({
            stock_item_id: item.stock_item_id,
            requested_quantity: item.quantity,
            available_quantity: available,
          });
        }
      }

      if (insufficientItems.length > 0) {
        throw new SalesServiceError(
          'Insufficient stock for one or more items',
          422,
          { insufficient_items: insufficientItems }
        );
      }

      // 5. Calculate line totals and total amount
      const lineItemsWithTotals = data.line_items.map((item) => ({
        ...item,
        line_total: this.roundToTwoDecimals(item.quantity * item.unit_price),
      }));

      const totalAmount = this.calculateTotal(data.line_items);

      // 6. Generate unique reference number
      const referenceNumber = this.generateReferenceNumber();

      // 7. Insert sale transaction
      const saleResult = await client.query(
        `INSERT INTO sale_transactions (reference_number, branch_id, created_by, total_amount, transaction_date)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [referenceNumber, data.branch_id, userId, totalAmount]
      );

      const saleTransaction = saleResult.rows[0] as SaleTransaction;

      // 8. Insert line items and deduct stock
      const insertedLineItems: SaleLineItemWithDetails[] = [];

      for (const item of lineItemsWithTotals) {
        // Insert line item
        const lineResult = await client.query(
          `INSERT INTO sale_line_items (sale_transaction_id, stock_item_id, quantity, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            saleTransaction.id,
            item.stock_item_id,
            item.quantity,
            item.unit_price,
            item.line_total,
          ]
        );

        insertedLineItems.push(lineResult.rows[0] as SaleLineItemWithDetails);

        // Deduct stock
        await client.query(
          `UPDATE stock_levels
           SET quantity = quantity - $1, last_updated = NOW()
           WHERE branch_id = $2 AND stock_item_id = $3`,
          [item.quantity, data.branch_id, item.stock_item_id]
        );
      }

      return {
        ...saleTransaction,
        line_items: insertedLineItems,
      };
    });
  }

  /**
   * Get sale transactions for a branch with optional filtering and pagination.
   * Includes line items with stock item names.
   */
  async getTransactions(
    branchId: string,
    filters?: SaleFilters
  ): Promise<PaginatedSales> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    // Build query conditions
    const conditions: string[] = ['st.branch_id = $1'];
    const values: unknown[] = [branchId];
    let paramIndex = 2;

    if (filters?.startDate) {
      conditions.push(`st.transaction_date >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push(`st.transaction_date <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM sale_transactions st WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated transactions
    const transactionsResult = await query(
      `SELECT st.*
       FROM sale_transactions st
       WHERE ${whereClause}
       ORDER BY st.transaction_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, pageSize, offset]
    );

    const transactions: SaleTransactionWithLineItems[] = [];

    // Fetch line items for each transaction
    for (const txn of transactionsResult.rows) {
      const lineItemsResult = await query(
        `SELECT sli.*, si.name AS stock_item_name, si.sku AS stock_item_sku
         FROM sale_line_items sli
         JOIN stock_items si ON sli.stock_item_id = si.id
         WHERE sli.sale_transaction_id = $1
         ORDER BY si.name ASC`,
        [txn.id]
      );

      transactions.push({
        ...txn,
        line_items: lineItemsResult.rows as SaleLineItemWithDetails[],
      });
    }

    return {
      transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Pure function: Calculate the total amount from line items.
   * Returns sum of (quantity * unit_price) rounded to 2 decimal places.
   */
  calculateTotal(lineItems: Array<{ quantity: number; unit_price: number }>): number {
    const sum = lineItems.reduce((acc, item) => {
      return acc + item.quantity * item.unit_price;
    }, 0);

    return this.roundToTwoDecimals(sum);
  }

  /**
   * Generate a unique reference number.
   * Format: TXN-{timestamp}-{random4digits}
   */
  private generateReferenceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * Round a number to exactly 2 decimal places.
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

export const salesService = new SalesService();
