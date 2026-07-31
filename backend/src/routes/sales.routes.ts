import { Router, Request, Response } from 'express';
import { salesService, SalesServiceError } from '../services/sales.service';
import { requirePermission } from '../middleware/rbac.middleware';
import { createSaleSchema } from '../types/schemas';
import { auditLog } from '../services/audit.service';
import { ZodError } from 'zod';

const router = Router();

/**
 * POST /api/sales
 * Create a new sale transaction with atomic stock deduction.
 * Requires: sales:create permission, scoped to the body's branch_id.
 *
 * Body: { branch_id, line_items: [{ stock_item_id, quantity, unit_price }] }
 * Returns: 201 with the transaction, line items, and reference number.
 * Errors: 400 (validation), 404 (branch not found), 422 (insufficient stock / inactive branch)
 */
router.post(
  '/',
  requirePermission('sales:create', (req) => req.body.branch_id),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const data = createSaleSchema.parse(req.body);

      // Create the transaction
      const transaction = await salesService.createTransaction(
        req.user!.userId,
        data
      );

      // Log audit trail
      const lineCount = transaction.line_items.length;
      const totalAmount = Number(transaction.total_amount).toFixed(2);
      auditLog(
        req.user!.userId,
        data.branch_id,
        'sale_created',
        `Sale ${transaction.reference_number} created: ${lineCount} item${lineCount > 1 ? 's' : ''}, total $${totalAmount}`,
        {
          reference_number: transaction.reference_number,
          transaction_id: transaction.id,
          total_amount: transaction.total_amount,
          line_item_count: lineCount,
        }
      );

      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid request data',
          details: error.errors,
        });
        return;
      }

      if (error instanceof SalesServiceError) {
        res.status(error.statusCode).json({
          error: error.statusCode === 404 ? 'Not found' : 'Unprocessable entity',
          message: error.message,
          details: error.details,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create sale transaction',
      });
    }
  }
);

/**
 * GET /api/sales/:branchId
 * List sale transactions for a branch with optional filters.
 * Requires: sales:read permission, scoped to the branch in params.
 *
 * Query params: startDate, endDate, page, pageSize
 * Returns: Paginated list of transactions with line items.
 */
router.get(
  '/:branchId',
  requirePermission('sales:read', (req) => req.params.branchId),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.params.branchId;

      // Parse query parameters
      const startDate = typeof req.query.startDate === 'string'
        ? new Date(req.query.startDate)
        : undefined;
      const endDate = typeof req.query.endDate === 'string'
        ? new Date(req.query.endDate + 'T23:59:59.999Z')
        : undefined;
      const page = typeof req.query.page === 'string'
        ? parseInt(req.query.page, 10)
        : undefined;
      const pageSize = typeof req.query.pageSize === 'string'
        ? parseInt(req.query.pageSize, 10)
        : undefined;

      // Validate date parsing
      if (startDate && isNaN(startDate.getTime())) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid startDate format',
        });
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid endDate format',
        });
        return;
      }

      const result = await salesService.getTransactions(branchId, {
        startDate,
        endDate,
        page: page && page > 0 ? page : undefined,
        pageSize: pageSize && pageSize > 0 ? pageSize : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve sale transactions',
      });
    }
  }
);

export default router;
