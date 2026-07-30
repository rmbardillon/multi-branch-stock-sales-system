import { Router, Request, Response } from 'express';
import { transferService, TransferServiceError } from '../services/transfer.service';
import { requirePermission } from '../middleware/rbac.middleware';
import { createTransferSchema } from '../types/schemas';
import { ZodError } from 'zod';
import type { TransferStatus } from '../types/entities';

const router = Router();

/**
 * POST /api/transfers
 * Initiate a new stock transfer between branches.
 * Requires: transfer:initiate permission, scoped to the source branch.
 *
 * Body: { source_branch_id, destination_branch_id, line_items: [{ stock_item_id, quantity }] }
 * Returns: 201 with the transfer record and line items.
 * Errors: 400 (validation), 403 (wrong branch), 404 (branch not found)
 */
router.post(
  '/',
  requirePermission('transfer:initiate', (req) => req.body.source_branch_id),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const data = createTransferSchema.parse(req.body);

      // Initiate the transfer
      const transfer = await transferService.initiate(req.user!.userId, data);

      res.status(201).json(transfer);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid request data',
          details: error.errors,
        });
        return;
      }

      if (error instanceof TransferServiceError) {
        res.status(error.statusCode).json({
          error:
            error.statusCode === 404
              ? 'Not found'
              : error.statusCode === 403
                ? 'Forbidden'
                : 'Bad request',
          message: error.message,
          details: error.details,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to initiate stock transfer',
      });
    }
  }
);

/**
 * POST /api/transfers/:id/confirm
 * Confirm a pending stock transfer (atomic stock level update).
 * Requires: transfer:approve permission.
 *
 * Returns: 200 with the confirmed transfer and line items.
 * Errors: 404 (not found), 422 (insufficient stock / already confirmed/failed)
 */
router.post(
  '/:id/confirm',
  requirePermission('transfer:approve'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const transferId = req.params.id;

      const confirmedTransfer = await transferService.confirm(
        transferId,
        req.user!.userId
      );

      res.status(200).json(confirmedTransfer);
    } catch (error) {
      if (error instanceof TransferServiceError) {
        res.status(error.statusCode).json({
          error:
            error.statusCode === 404
              ? 'Not found'
              : 'Unprocessable entity',
          message: error.message,
          details: error.details,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to confirm stock transfer',
      });
    }
  }
);

/**
 * GET /api/transfers/:branchId
 * List stock transfers for a branch with optional filters.
 * Requires: transfer:initiate permission, scoped to the branch in params.
 *
 * Query params: status (pending/confirmed/failed), page, pageSize
 * Returns: Paginated list of transfers with line items.
 */
router.get(
  '/:branchId',
  requirePermission('transfer:initiate', (req) => req.params.branchId),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.params.branchId;

      // Parse query parameters
      const status = typeof req.query.status === 'string'
        ? (req.query.status as TransferStatus)
        : undefined;
      const page = typeof req.query.page === 'string'
        ? parseInt(req.query.page, 10)
        : undefined;
      const pageSize = typeof req.query.pageSize === 'string'
        ? parseInt(req.query.pageSize, 10)
        : undefined;

      // Validate status if provided
      if (status && !['pending', 'confirmed', 'failed'].includes(status)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid status filter. Must be one of: pending, confirmed, failed',
        });
        return;
      }

      const result = await transferService.getTransfers(branchId, {
        status,
        page: page && page > 0 ? page : undefined,
        pageSize: pageSize && pageSize > 0 ? pageSize : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve stock transfers',
      });
    }
  }
);

export default router;
