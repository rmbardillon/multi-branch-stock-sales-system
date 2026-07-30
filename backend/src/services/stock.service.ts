import { query } from '../database/connection';
import type { StockItem, StockLevel } from '../types/entities';
import type { CreateStockItemDto, UpdateStockItemDto } from '../types/dtos';

export interface StockLevelWithItem extends StockLevel {
  item_name: string;
  item_sku: string;
  item_category: string;
}

export interface ConsolidatedStock {
  stock_item: StockItem;
  levels: Array<{
    branch_id: string;
    branch_name: string;
    quantity: number;
    last_updated: Date;
  }>;
  total_quantity: number;
}

export interface LowStockAlert {
  stock_item_id: string;
  stock_item_name: string;
  sku: string;
  category: string;
  branch_id: string;
  branch_name: string;
  quantity: number;
  low_stock_threshold: number;
}

export class StockServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'StockServiceError';
    this.statusCode = statusCode;
  }
}

export class StockService {
  /**
   * Create a new stock item.
   * Enforces unique SKU constraint (409 on conflict).
   */
  async createItem(data: CreateStockItemDto): Promise<StockItem> {
    // Check for SKU uniqueness
    const existing = await query(
      'SELECT id FROM stock_items WHERE LOWER(sku) = LOWER($1)',
      [data.sku]
    );

    if (existing.rows.length > 0) {
      throw new StockServiceError(
        `A stock item with SKU "${data.sku}" already exists`,
        409
      );
    }

    const result = await query(
      `INSERT INTO stock_items (sku, name, description, category, unit_price, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.sku,
        data.name,
        data.description || '',
        data.category,
        data.unit_price,
        data.low_stock_threshold,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update an existing stock item.
   * Enforces unique SKU constraint on change (409 on conflict).
   */
  async updateItem(id: string, data: UpdateStockItemDto): Promise<StockItem> {
    // Verify item exists
    const existingItem = await query(
      'SELECT * FROM stock_items WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      throw new StockServiceError('Stock item not found', 404);
    }

    // If SKU is being updated, check uniqueness
    if (data.sku) {
      const skuConflict = await query(
        'SELECT id FROM stock_items WHERE LOWER(sku) = LOWER($1) AND id != $2',
        [data.sku, id]
      );

      if (skuConflict.rows.length > 0) {
        throw new StockServiceError(
          `A stock item with SKU "${data.sku}" already exists`,
          409
        );
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.sku !== undefined) {
      updates.push(`sku = $${paramIndex++}`);
      values.push(data.sku);
    }
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.unit_price !== undefined) {
      updates.push(`unit_price = $${paramIndex++}`);
      values.push(data.unit_price);
    }
    if (data.low_stock_threshold !== undefined) {
      updates.push(`low_stock_threshold = $${paramIndex++}`);
      values.push(data.low_stock_threshold);
    }

    if (updates.length === 0) {
      // Nothing to update, return existing item
      return existingItem.rows[0];
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE stock_items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Search stock items by SKU, name, or category using case-insensitive partial matching.
   */
  async search(searchQuery: string): Promise<StockItem[]> {
    const pattern = `%${searchQuery}%`;

    const result = await query(
      `SELECT * FROM stock_items
       WHERE (sku ILIKE $1 OR name ILIKE $1 OR category ILIKE $1)
         AND is_active = true
       ORDER BY name ASC`,
      [pattern]
    );

    return result.rows;
  }

  /**
   * Get a single stock level for a specific branch and item.
   */
  async getStockLevel(branchId: string, itemId: string): Promise<StockLevel | null> {
    const result = await query(
      `SELECT * FROM stock_levels
       WHERE branch_id = $1 AND stock_item_id = $2`,
      [branchId, itemId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all stock levels for a branch, joined with stock item info.
   */
  async getStockLevels(branchId: string): Promise<StockLevelWithItem[]> {
    const result = await query(
      `SELECT sl.*, si.name AS item_name, si.sku AS item_sku, si.category AS item_category, si.unit_price, si.low_stock_threshold
       FROM stock_levels sl
       JOIN stock_items si ON sl.stock_item_id = si.id
       WHERE sl.branch_id = $1 AND si.is_active = true
       ORDER BY si.name ASC`,
      [branchId]
    );

    return result.rows;
  }

  /**
   * Get consolidated stock levels across all branches for a given item.
   */
  async getConsolidatedView(itemId: string): Promise<ConsolidatedStock | null> {
    // Get the stock item
    const itemResult = await query(
      'SELECT * FROM stock_items WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return null;
    }

    const stockItem = itemResult.rows[0];

    // Get stock levels across all branches
    const levelsResult = await query(
      `SELECT sl.branch_id, b.name AS branch_name, sl.quantity, sl.last_updated
       FROM stock_levels sl
       JOIN branches b ON sl.branch_id = b.id
       WHERE sl.stock_item_id = $1
       ORDER BY b.name ASC`,
      [itemId]
    );

    const levels = levelsResult.rows;
    const totalQuantity = levels.reduce(
      (sum: number, level: { quantity: number }) => sum + level.quantity,
      0
    );

    return {
      stock_item: stockItem,
      levels,
      total_quantity: totalQuantity,
    };
  }

  /**
   * Get low stock alerts — items where quantity < low_stock_threshold.
   * Optionally filtered by branch.
   */
  async getLowStockAlerts(branchId?: string): Promise<LowStockAlert[]> {
    let queryText = `
      SELECT 
        si.id AS stock_item_id,
        si.name AS stock_item_name,
        si.sku,
        si.category,
        sl.branch_id,
        b.name AS branch_name,
        sl.quantity,
        si.low_stock_threshold
      FROM stock_levels sl
      JOIN stock_items si ON sl.stock_item_id = si.id
      JOIN branches b ON sl.branch_id = b.id
      WHERE sl.quantity < si.low_stock_threshold
        AND si.is_active = true
        AND b.status = 'Active'
    `;

    const params: unknown[] = [];

    if (branchId) {
      queryText += ` AND sl.branch_id = $1`;
      params.push(branchId);
    }

    queryText += ` ORDER BY si.name ASC, b.name ASC`;

    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * Get a single stock item by ID.
   */
  async getById(id: string): Promise<StockItem | null> {
    const result = await query(
      'SELECT * FROM stock_items WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * List all active stock items.
   */
  async list(): Promise<StockItem[]> {
    const result = await query(
      'SELECT * FROM stock_items WHERE is_active = true ORDER BY name ASC'
    );

    return result.rows;
  }
}

export const stockService = new StockService();
