import { Router, Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

/**
 * GET /api/audit
 * Query audit records with optional filters and pagination.
 * Requires: Admin role
 * Query params: startDate, endDate, userId, branchId, actionType, page, pageSize
 *
 * Returns paginated audit records within 5 seconds for queries spanning up to 12 months.
 */
router.get(
  '/',
  requireAdmin(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, userId, branchId, actionType, page, pageSize } = req.query;

      // Parse and validate dates if provided
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate) {
        parsedStartDate = new Date(startDate as string);
        if (isNaN(parsedStartDate.getTime())) {
          res.status(400).json({
            error: 'Validation error',
            message: 'startDate must be a valid date string',
          });
          return;
        }
      }

      if (endDate) {
        parsedEndDate = new Date((endDate as string) + 'T23:59:59.999Z');
        if (isNaN(parsedEndDate.getTime())) {
          res.status(400).json({
            error: 'Validation error',
            message: 'endDate must be a valid date string',
          });
          return;
        }
      }

      // Parse pagination params
      const parsedPage = page ? parseInt(page as string, 10) : 1;
      const parsedPageSize = pageSize ? parseInt(pageSize as string, 10) : 50;

      if (isNaN(parsedPage) || parsedPage < 1) {
        res.status(400).json({
          error: 'Validation error',
          message: 'page must be a positive integer',
        });
        return;
      }

      if (isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 100) {
        res.status(400).json({
          error: 'Validation error',
          message: 'pageSize must be between 1 and 100',
        });
        return;
      }

      const result = await auditService.query({
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        userId: userId as string | undefined,
        branchId: branchId as string | undefined,
        actionType: actionType as string | undefined,
        page: parsedPage,
        pageSize: parsedPageSize,
      });

      if (result.records.length === 0) {
        res.status(200).json({
          data: [],
          total: 0,
          page: result.page,
          pageSize: result.pageSize,
          message: 'No audit records found for the selected filters',
        });
        return;
      }

      res.status(200).json({
        data: result.records,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to query audit records',
      });
    }
  }
);

export default router;
