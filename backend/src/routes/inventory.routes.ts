import { Router, Request, Response } from 'express';
import { stockService } from '../services/stock.service';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

/**
 * GET /api/inventory/alerts
 * Get low-stock alerts (items where quantity < low_stock_threshold).
 * Requires: inventory:read permission
 * Optional query param: branchId - filter alerts to a specific branch
 *
 * For branch-scoped users (Branch_Manager, Sales_Staff), only their branch's alerts are returned.
 */
router.get(
  '/alerts',
  requirePermission('inventory:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const queryBranchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
      let branchId: string | undefined = queryBranchId;

      // Non-Admin users can only see alerts for their assigned branch
      if (user.role !== 'Admin') {
        branchId = user.assignedBranchId || undefined;
      }

      const alerts = await stockService.getLowStockAlerts(branchId);
      res.status(200).json(alerts);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve low-stock alerts',
      });
    }
  }
);

/**
 * GET /api/inventory/consolidated/:itemId
 * Get cross-branch stock levels for a single item.
 * Requires: inventory:read permission
 */
router.get(
  '/consolidated/:itemId',
  requirePermission('inventory:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemId = req.params.itemId as string;
      const consolidated = await stockService.getConsolidatedView(itemId);

      if (!consolidated) {
        res.status(404).json({
          error: 'Not found',
          message: 'Stock item not found',
        });
        return;
      }

      // Reshape to match frontend expected structure
      res.status(200).json({
        item_id: consolidated.stock_item.id,
        item_name: consolidated.stock_item.name,
        sku: consolidated.stock_item.sku,
        total_quantity: consolidated.total_quantity,
        branches: consolidated.levels,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve consolidated stock view',
      });
    }
  }
);

/**
 * GET /api/inventory/:branchId
 * Get all stock levels for a branch with item info.
 * Requires: inventory:read permission, branch-scoped for non-Admin users.
 */
router.get(
  '/:branchId',
  requirePermission('inventory:read', (req) => req.params.branchId as string),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.params.branchId as string;
      const levels = await stockService.getStockLevels(branchId);
      // Reshape flat rows into nested structure expected by frontend
      const shaped = levels.map((row: any) => ({
        id: row.id,
        branch_id: row.branch_id,
        stock_item_id: row.stock_item_id,
        quantity: row.quantity,
        last_updated: row.last_updated,
        stock_item: {
          id: row.stock_item_id,
          sku: row.item_sku,
          name: row.item_name,
          category: row.item_category,
          unit_price: row.unit_price,
          low_stock_threshold: row.low_stock_threshold,
        },
      }));
      res.status(200).json(shaped);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve stock levels',
      });
    }
  }
);

export default router;
