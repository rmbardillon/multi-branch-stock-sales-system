import { Router, Request, Response } from 'express';
import { createStockItemSchema, updateStockItemSchema } from '../types/schemas';
import { stockService, StockServiceError } from '../services/stock.service';
import { requirePermission } from '../middleware/rbac.middleware';
import { query } from '../database/connection';

const router = Router();

/**
 * GET /api/stock-items
 * List all active stock items.
 * Requires: stock_item:read permission
 */
router.get(
  '/',
  requirePermission('stock_item:read'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await stockService.list();
      res.status(200).json(items);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve stock items',
      });
    }
  }
);

/**
 * POST /api/stock-items
 * Create a new stock item.
 * Requires: stock_item:write permission
 */
router.post(
  '/',
  requirePermission('stock_item:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = createStockItemSchema.safeParse(req.body);

      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid stock item data',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const item = await stockService.createItem(parseResult.data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof StockServiceError) {
        res.status(error.statusCode).json({
          error: error.statusCode === 409 ? 'Conflict' : 'Error',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create stock item',
      });
    }
  }
);

/**
 * GET /api/stock-items/search
 * Search stock items by SKU, name, or category (case-insensitive partial match).
 * Requires: stock_item:read permission
 * Query params: q (search query)
 */
router.get(
  '/search',
  requirePermission('stock_item:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const searchQuery = req.query.q as string;

      if (!searchQuery || searchQuery.trim().length === 0) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'Search query parameter "q" is required',
        });
        return;
      }

      const items = await stockService.search(searchQuery.trim());
      res.status(200).json(items);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to search stock items',
      });
    }
  }
);

/**
 * GET /api/stock-items/sku/:sku
 * Get a single stock item by exact SKU (case-insensitive).
 * Designed for barcode scanner / POS lookup.
 * Requires: stock_item:read permission
 */
router.get(
  '/sku/:sku',
  requirePermission('stock_item:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sku = req.params.sku;

      if (!sku || sku.trim().length === 0) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'SKU parameter is required',
        });
        return;
      }

      const result = await query(
        `SELECT * FROM stock_items WHERE LOWER(sku) = LOWER($1) AND is_active = true`,
        [sku.trim()]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not found',
          message: `No active stock item found with SKU "${sku}"`,
        });
        return;
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to look up stock item by SKU',
      });
    }
  }
);

/**
 * GET /api/stock-items/:id
 * Get a single stock item by ID.
 * Requires: stock_item:read permission
 */
router.get(
  '/:id',
  requirePermission('stock_item:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const item = await stockService.getById(req.params.id);

      if (!item) {
        res.status(404).json({
          error: 'Not found',
          message: 'Stock item not found',
        });
        return;
      }

      res.status(200).json(item);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve stock item',
      });
    }
  }
);

/**
 * PUT /api/stock-items/:id
 * Update a stock item.
 * Requires: stock_item:write permission
 */
router.put(
  '/:id',
  requirePermission('stock_item:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = updateStockItemSchema.safeParse(req.body);

      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid stock item data',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const item = await stockService.updateItem(req.params.id, parseResult.data);
      res.status(200).json(item);
    } catch (error) {
      if (error instanceof StockServiceError) {
        res.status(error.statusCode).json({
          error: error.statusCode === 409 ? 'Conflict' : error.statusCode === 404 ? 'Not found' : 'Error',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update stock item',
      });
    }
  }
);

export default router;
