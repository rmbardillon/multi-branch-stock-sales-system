import { Router, Request, Response } from 'express';
import { reportService, ReportServiceError } from '../services/report.service';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

/**
 * GET /api/reports/sales
 * Generate a sales report with filters.
 * Requires: report:read permission
 * Query params: startDate, endDate, branchId, category
 *
 * For non-Admin users, automatically scopes to their assigned branch.
 */
router.get(
  '/sales',
  requirePermission('report:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { startDate, endDate, branchId, category } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Validation error',
          message: 'startDate and endDate query parameters are required',
        });
        return;
      }

      const parsedStartDate = new Date(startDate as string);
      const parsedEndDate = new Date((endDate as string) + 'T23:59:59.999Z');

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        res.status(400).json({
          error: 'Validation error',
          message: 'startDate and endDate must be valid date strings',
        });
        return;
      }

      // For non-Admin users, scope to their assigned branch
      let effectiveBranchId: string | undefined = branchId as string | undefined;
      if (user.role !== 'Admin') {
        effectiveBranchId = user.assignedBranchId || undefined;
      }

      const report = await reportService.generateSalesReport({
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        branchId: effectiveBranchId,
        category: category as string | undefined,
      });

      if (report.length === 0) {
        res.status(200).json({
          data: [],
          message: 'No data available for the selected filters',
        });
        return;
      }

      res.status(200).json({ data: report });
    } catch (error) {
      if (error instanceof ReportServiceError) {
        res.status(error.statusCode).json({
          error: 'Report error',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate sales report',
      });
    }
  }
);

/**
 * GET /api/reports/stock
 * Generate a stock report.
 * Requires: report:read permission
 * Query params: branchId, startDate, endDate
 *
 * For non-Admin users, automatically scopes to their assigned branch.
 */
router.get(
  '/stock',
  requirePermission('report:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { branchId, startDate, endDate } = req.query;

      // For non-Admin users, scope to their assigned branch
      let effectiveBranchId: string | undefined = branchId as string | undefined;
      if (user.role !== 'Admin') {
        effectiveBranchId = user.assignedBranchId || undefined;
      }

      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date((endDate as string) + 'T23:59:59.999Z') : undefined;

      if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          error: 'Validation error',
          message: 'startDate must be a valid date string',
        });
        return;
      }

      if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
        res.status(400).json({
          error: 'Validation error',
          message: 'endDate must be a valid date string',
        });
        return;
      }

      const report = await reportService.generateStockReport({
        branchId: effectiveBranchId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      });

      if (report.length === 0) {
        res.status(200).json({
          data: [],
          message: 'No data available for the selected filters',
        });
        return;
      }

      res.status(200).json({ data: report });
    } catch (error) {
      if (error instanceof ReportServiceError) {
        res.status(error.statusCode).json({
          error: 'Report error',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate stock report',
      });
    }
  }
);

/**
 * GET /api/reports/export
 * Export report data as CSV download.
 * Requires: report:export permission
 * Query params: type (sales|stock), startDate, endDate, branchId, category
 *
 * For non-Admin users, automatically scopes to their assigned branch.
 */
router.get(
  '/export',
  requirePermission('report:export'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { type, startDate, endDate, branchId, category } = req.query;

      if (!type || (type !== 'sales' && type !== 'stock')) {
        res.status(400).json({
          error: 'Validation error',
          message: 'type query parameter is required and must be "sales" or "stock"',
        });
        return;
      }

      // For non-Admin users, scope to their assigned branch
      let effectiveBranchId: string | undefined = branchId as string | undefined;
      if (user.role !== 'Admin') {
        effectiveBranchId = user.assignedBranchId || undefined;
      }

      let csvBuffer: Buffer;
      let filename: string;

      if (type === 'sales') {
        if (!startDate || !endDate) {
          res.status(400).json({
            error: 'Validation error',
            message: 'startDate and endDate are required for sales export',
          });
          return;
        }

        const parsedStartDate = new Date(startDate as string);
        const parsedEndDate = new Date((endDate as string) + 'T23:59:59.999Z');

        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
          res.status(400).json({
            error: 'Validation error',
            message: 'startDate and endDate must be valid date strings',
          });
          return;
        }

        const salesData = await reportService.generateSalesReport({
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          branchId: effectiveBranchId,
          category: category as string | undefined,
        });

        const headers = ['item_name', 'sku', 'category', 'total_quantity_sold', 'total_revenue'];
        csvBuffer = reportService.exportToCsv(
          salesData.map((item) => ({
            item_name: item.item_name,
            sku: item.sku,
            category: item.category,
            total_quantity_sold: item.total_quantity_sold,
            total_revenue: item.total_revenue,
          })),
          headers
        );
        filename = `sales-report-${(startDate as string).slice(0, 10)}-to-${(endDate as string).slice(0, 10)}.csv`;
      } else {
        // Stock report
        const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
        const parsedEndDate = endDate ? new Date((endDate as string) + 'T23:59:59.999Z') : undefined;

        if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
          res.status(400).json({
            error: 'Validation error',
            message: 'startDate must be a valid date string',
          });
          return;
        }

        if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
          res.status(400).json({
            error: 'Validation error',
            message: 'endDate must be a valid date string',
          });
          return;
        }

        const stockData = await reportService.generateStockReport({
          branchId: effectiveBranchId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        });

        const headers = [
          'item_name',
          'sku',
          'category',
          'branch_name',
          'current_quantity',
          'low_stock_threshold',
          'is_low_stock',
          'recent_sales_quantity',
          'recent_transfers_in',
          'recent_transfers_out',
        ];
        csvBuffer = reportService.exportToCsv(
          stockData.map((item) => ({
            item_name: item.item_name,
            sku: item.sku,
            category: item.category,
            branch_name: item.branch_name,
            current_quantity: item.current_quantity,
            low_stock_threshold: item.low_stock_threshold,
            is_low_stock: item.is_low_stock ? 'Yes' : 'No',
            recent_sales_quantity: item.recent_sales_quantity,
            recent_transfers_in: item.recent_transfers_in,
            recent_transfers_out: item.recent_transfers_out,
          })),
          headers
        );
        filename = `stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvBuffer);
    } catch (error) {
      if (error instanceof ReportServiceError) {
        res.status(error.statusCode).json({
          error: 'Report error',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to export report',
      });
    }
  }
);

export default router;
