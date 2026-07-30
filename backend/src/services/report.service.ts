import { query } from '../database/connection';

export interface SalesReportFilters {
  startDate: Date;
  endDate: Date;
  branchId?: string;
  category?: string;
}

export interface SalesReportItem {
  stock_item_id: string;
  item_name: string;
  sku: string;
  category: string;
  total_quantity_sold: number;
  total_revenue: number;
}

export interface StockReportFilters {
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface StockReportItem {
  stock_item_id: string;
  item_name: string;
  sku: string;
  category: string;
  branch_id: string;
  branch_name: string;
  current_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  recent_sales_quantity: number;
  recent_transfers_in: number;
  recent_transfers_out: number;
}

export class ReportServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ReportServiceError';
    this.statusCode = statusCode;
  }
}

export class ReportService {
  /**
   * Generate a sales report grouped by item.
   * Joins sale_line_items with sale_transactions and stock_items.
   * Applies date range, branch, and category filters.
   * For Admin without branchId: aggregates across all branches.
   */
  async generateSalesReport(filters: SalesReportFilters): Promise<SalesReportItem[]> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const conditions: string[] = [
      'st.transaction_date >= $1',
      'st.transaction_date <= $2',
    ];
    const values: unknown[] = [filters.startDate, filters.endDate];
    let paramIndex = 3;

    if (filters.branchId) {
      conditions.push(`st.branch_id = $${paramIndex++}`);
      values.push(filters.branchId);
    }

    if (filters.category) {
      conditions.push(`si.category = $${paramIndex++}`);
      values.push(filters.category);
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `SELECT
        si.id AS stock_item_id,
        si.name AS item_name,
        si.sku,
        si.category,
        COALESCE(SUM(sli.quantity), 0)::integer AS total_quantity_sold,
        COALESCE(SUM(sli.line_total), 0)::numeric AS total_revenue
      FROM sale_line_items sli
      JOIN sale_transactions st ON sli.sale_transaction_id = st.id
      JOIN stock_items si ON sli.stock_item_id = si.id
      WHERE ${whereClause}
      GROUP BY si.id, si.name, si.sku, si.category
      ORDER BY total_revenue DESC`,
      values
    );

    return result.rows.map((row) => ({
      stock_item_id: row.stock_item_id,
      item_name: row.item_name,
      sku: row.sku,
      category: row.category,
      total_quantity_sold: parseInt(row.total_quantity_sold, 10),
      total_revenue: parseFloat(row.total_revenue),
    }));
  }

  /**
   * Generate a stock report with current levels and movement history.
   * Includes low-stock items and recent sales/transfers data.
   */
  async generateStockReport(filters: StockReportFilters): Promise<StockReportItem[]> {
    if (filters.startDate && filters.endDate) {
      this.validateDateRange(filters.startDate, filters.endDate);
    }

    // Default date range for movement history: last 30 days
    const movementStart = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const movementEnd = filters.endDate || new Date();

    const conditions: string[] = [];
    const values: unknown[] = [movementStart, movementEnd];
    let paramIndex = 3;

    if (filters.branchId) {
      conditions.push(`sl.branch_id = $${paramIndex++}`);
      values.push(filters.branchId);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const result = await query(
      `SELECT
        si.id AS stock_item_id,
        si.name AS item_name,
        si.sku,
        si.category,
        sl.branch_id,
        b.name AS branch_name,
        sl.quantity AS current_quantity,
        si.low_stock_threshold,
        (sl.quantity < si.low_stock_threshold) AS is_low_stock,
        COALESCE(sales_agg.total_sold, 0)::integer AS recent_sales_quantity,
        COALESCE(transfers_in_agg.total_in, 0)::integer AS recent_transfers_in,
        COALESCE(transfers_out_agg.total_out, 0)::integer AS recent_transfers_out
      FROM stock_levels sl
      JOIN stock_items si ON sl.stock_item_id = si.id
      JOIN branches b ON sl.branch_id = b.id
      LEFT JOIN (
        SELECT sli.stock_item_id, st.branch_id, SUM(sli.quantity) AS total_sold
        FROM sale_line_items sli
        JOIN sale_transactions st ON sli.sale_transaction_id = st.id
        WHERE st.transaction_date >= $1 AND st.transaction_date <= $2
        GROUP BY sli.stock_item_id, st.branch_id
      ) sales_agg ON sales_agg.stock_item_id = sl.stock_item_id AND sales_agg.branch_id = sl.branch_id
      LEFT JOIN (
        SELECT tli.stock_item_id, stx.destination_branch_id AS branch_id, SUM(tli.quantity) AS total_in
        FROM transfer_line_items tli
        JOIN stock_transfers stx ON tli.stock_transfer_id = stx.id
        WHERE stx.status = 'confirmed' AND stx.confirmed_at >= $1 AND stx.confirmed_at <= $2
        GROUP BY tli.stock_item_id, stx.destination_branch_id
      ) transfers_in_agg ON transfers_in_agg.stock_item_id = sl.stock_item_id AND transfers_in_agg.branch_id = sl.branch_id
      LEFT JOIN (
        SELECT tli.stock_item_id, stx.source_branch_id AS branch_id, SUM(tli.quantity) AS total_out
        FROM transfer_line_items tli
        JOIN stock_transfers stx ON tli.stock_transfer_id = stx.id
        WHERE stx.status = 'confirmed' AND stx.confirmed_at >= $1 AND stx.confirmed_at <= $2
        GROUP BY tli.stock_item_id, stx.source_branch_id
      ) transfers_out_agg ON transfers_out_agg.stock_item_id = sl.stock_item_id AND transfers_out_agg.branch_id = sl.branch_id
      ${whereClause}
      ORDER BY b.name, si.name`,
      values
    );

    return result.rows.map((row) => ({
      stock_item_id: row.stock_item_id,
      item_name: row.item_name,
      sku: row.sku,
      category: row.category,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      current_quantity: parseInt(row.current_quantity, 10),
      low_stock_threshold: parseInt(row.low_stock_threshold, 10),
      is_low_stock: row.is_low_stock,
      recent_sales_quantity: parseInt(row.recent_sales_quantity, 10),
      recent_transfers_in: parseInt(row.recent_transfers_in, 10),
      recent_transfers_out: parseInt(row.recent_transfers_out, 10),
    }));
  }

  /**
   * Convert an array of data objects to a CSV string.
   * Returns a Buffer suitable for download.
   */
  exportToCsv(data: Record<string, unknown>[], headers: string[]): Buffer {
    if (data.length === 0) {
      // Return just headers if no data
      const headerLine = headers.map((h) => this.escapeCsvField(h)).join(',');
      return Buffer.from(headerLine + '\n', 'utf-8');
    }

    const headerLine = headers.map((h) => this.escapeCsvField(h)).join(',');

    const rows = data.map((row) => {
      return headers.map((header) => {
        const value = row[header];
        return this.escapeCsvField(value != null ? String(value) : '');
      }).join(',');
    });

    const csv = [headerLine, ...rows].join('\n') + '\n';
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Escape a CSV field value.
   * Wraps in double quotes if it contains comma, newline, or double quote.
   */
  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Validate that the date range is at most 365 days.
   */
  private validateDateRange(startDate: Date, endDate: Date): void {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      throw new ReportServiceError(
        'End date must be after start date',
        400
      );
    }

    if (diffDays > 365) {
      throw new ReportServiceError(
        'Date range cannot exceed 365 days',
        400
      );
    }
  }
}

export const reportService = new ReportService();
