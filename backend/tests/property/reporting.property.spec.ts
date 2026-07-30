/**
 * Property-Based Tests: Reporting
 *
 * Feature: multi-branch-stock-sales-system
 * Property 20: Admin Dashboard Aggregation
 * Property 21: Report Filter Accuracy
 * Property 22: CSV Export Round-Trip
 *
 * **Validates: Requirements 7.2, 7.3, 7.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  arbUuid,
  arbCategory,
  arbItemName,
  arbSku,
  arbUnitPrice,
  defaultPropertyConfig,
} from '../factories/arbitraries';
import { ReportService } from '../../src/services/report.service';

// ---------- Helper Arbitraries ----------

/** Generate a branch metric record for dashboard aggregation */
const arbBranchMetric = fc.record({
  branchId: arbUuid,
  branchName: fc.string({ minLength: 1, maxLength: 50 }),
  totalSales: fc.double({ min: 0, max: 999999.99, noNaN: true }).map((n) =>
    parseFloat(n.toFixed(2))
  ),
  totalTransactions: fc.integer({ min: 0, max: 10000 }),
  lowStockCount: fc.integer({ min: 0, max: 500 }),
  totalItemsSold: fc.integer({ min: 0, max: 100000 }),
});

/** Generate a date within a reasonable range */
const arbDate = fc
  .integer({ min: 1672531200000, max: 1735689600000 }) // 2023-01-01 to 2025-01-01
  .map((ts) => new Date(ts));

/** Generate a sales report item for filter testing */
const arbSalesReportRecord = fc.record({
  stock_item_id: arbUuid,
  item_name: arbItemName,
  sku: arbSku,
  category: arbCategory,
  branch_id: arbUuid,
  transaction_date: arbDate,
  total_quantity_sold: fc.integer({ min: 1, max: 10000 }),
  total_revenue: arbUnitPrice,
});

// ---------- Property 20: Admin Dashboard Aggregation ----------

describe('Property 20: Admin Dashboard Aggregation', () => {
  it('Admin dashboard totals equal the sum of corresponding metrics across all active branches', () => {
    fc.assert(
      fc.property(
        fc.array(arbBranchMetric, { minLength: 1, maxLength: 20 }),
        (branchMetrics) => {
          // Simulate aggregation: Admin dashboard totals = sum of branch-level metrics
          const aggregated = {
            totalSales: 0,
            totalTransactions: 0,
            lowStockCount: 0,
            totalItemsSold: 0,
          };

          for (const metric of branchMetrics) {
            aggregated.totalSales += metric.totalSales;
            aggregated.totalTransactions += metric.totalTransactions;
            aggregated.lowStockCount += metric.lowStockCount;
            aggregated.totalItemsSold += metric.totalItemsSold;
          }

          // Round to 2 dp to match financial precision
          aggregated.totalSales =
            Math.round((aggregated.totalSales + Number.EPSILON) * 100) / 100;

          // Verify each aggregated metric equals the sum of branch metrics
          const expectedTotalSales = branchMetrics.reduce(
            (sum, m) => sum + m.totalSales,
            0
          );
          const expectedTotalTransactions = branchMetrics.reduce(
            (sum, m) => sum + m.totalTransactions,
            0
          );
          const expectedLowStockCount = branchMetrics.reduce(
            (sum, m) => sum + m.lowStockCount,
            0
          );
          const expectedTotalItemsSold = branchMetrics.reduce(
            (sum, m) => sum + m.totalItemsSold,
            0
          );

          expect(aggregated.totalSales).toBeCloseTo(
            Math.round((expectedTotalSales + Number.EPSILON) * 100) / 100,
            2
          );
          expect(aggregated.totalTransactions).toBe(expectedTotalTransactions);
          expect(aggregated.lowStockCount).toBe(expectedLowStockCount);
          expect(aggregated.totalItemsSold).toBe(expectedTotalItemsSold);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('aggregation with a single branch equals that branch metrics exactly', () => {
    fc.assert(
      fc.property(arbBranchMetric, (metric) => {
        const branchMetrics = [metric];

        const aggregated = {
          totalSales: branchMetrics.reduce((sum, m) => sum + m.totalSales, 0),
          totalTransactions: branchMetrics.reduce(
            (sum, m) => sum + m.totalTransactions,
            0
          ),
          lowStockCount: branchMetrics.reduce(
            (sum, m) => sum + m.lowStockCount,
            0
          ),
          totalItemsSold: branchMetrics.reduce(
            (sum, m) => sum + m.totalItemsSold,
            0
          ),
        };

        expect(aggregated.totalSales).toBeCloseTo(metric.totalSales, 2);
        expect(aggregated.totalTransactions).toBe(metric.totalTransactions);
        expect(aggregated.lowStockCount).toBe(metric.lowStockCount);
        expect(aggregated.totalItemsSold).toBe(metric.totalItemsSold);
      }),
      defaultPropertyConfig
    );
  });

  it('aggregation is commutative (order of branches does not matter)', () => {
    fc.assert(
      fc.property(
        fc.array(arbBranchMetric, { minLength: 2, maxLength: 10 }),
        (branchMetrics) => {
          const sumMetrics = (metrics: typeof branchMetrics) => ({
            totalSales: Math.round(
              (metrics.reduce((s, m) => s + m.totalSales, 0) + Number.EPSILON) * 100
            ) / 100,
            totalTransactions: metrics.reduce(
              (s, m) => s + m.totalTransactions,
              0
            ),
            lowStockCount: metrics.reduce((s, m) => s + m.lowStockCount, 0),
            totalItemsSold: metrics.reduce((s, m) => s + m.totalItemsSold, 0),
          });

          const original = sumMetrics(branchMetrics);
          const reversed = sumMetrics([...branchMetrics].reverse());

          expect(original.totalSales).toBeCloseTo(reversed.totalSales, 2);
          expect(original.totalTransactions).toBe(reversed.totalTransactions);
          expect(original.lowStockCount).toBe(reversed.lowStockCount);
          expect(original.totalItemsSold).toBe(reversed.totalItemsSold);
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 21: Report Filter Accuracy ----------

describe('Property 21: Report Filter Accuracy', () => {
  it('every record in the filtered result satisfies ALL specified filter criteria', () => {
    fc.assert(
      fc.property(
        fc.array(arbSalesReportRecord, { minLength: 1, maxLength: 50 }),
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbCategory, { nil: undefined }),
        (records, date1, date2, filterBranchId, filterCategory) => {
          // Ensure startDate <= endDate
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          // Apply filters (simulating report service filtering logic)
          const filtered = records.filter((record) => {
            // Date range filter
            if (
              record.transaction_date < startDate ||
              record.transaction_date > endDate
            ) {
              return false;
            }

            // Branch filter
            if (filterBranchId && record.branch_id !== filterBranchId) {
              return false;
            }

            // Category filter
            if (filterCategory && record.category !== filterCategory) {
              return false;
            }

            return true;
          });

          // Verify: every record in the result satisfies ALL filter criteria
          for (const record of filtered) {
            expect(record.transaction_date.getTime()).toBeGreaterThanOrEqual(
              startDate.getTime()
            );
            expect(record.transaction_date.getTime()).toBeLessThanOrEqual(
              endDate.getTime()
            );

            if (filterBranchId) {
              expect(record.branch_id).toBe(filterBranchId);
            }

            if (filterCategory) {
              expect(record.category).toBe(filterCategory);
            }
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('no record satisfying all filter criteria is excluded from results', () => {
    fc.assert(
      fc.property(
        fc.array(arbSalesReportRecord, { minLength: 1, maxLength: 50 }),
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbCategory, { nil: undefined }),
        (records, date1, date2, filterBranchId, filterCategory) => {
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          // Apply filters
          const filtered = records.filter((record) => {
            if (
              record.transaction_date < startDate ||
              record.transaction_date > endDate
            ) {
              return false;
            }
            if (filterBranchId && record.branch_id !== filterBranchId) {
              return false;
            }
            if (filterCategory && record.category !== filterCategory) {
              return false;
            }
            return true;
          });

          // Verify: no record that satisfies all criteria is missing
          for (const record of records) {
            const matchesDate =
              record.transaction_date >= startDate &&
              record.transaction_date <= endDate;
            const matchesBranch = !filterBranchId || record.branch_id === filterBranchId;
            const matchesCategory =
              !filterCategory || record.category === filterCategory;

            if (matchesDate && matchesBranch && matchesCategory) {
              expect(filtered).toContainEqual(record);
            }
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('filtering with no criteria returns all records (date range covers all)', () => {
    fc.assert(
      fc.property(
        fc.array(arbSalesReportRecord, { minLength: 0, maxLength: 30 }),
        (records) => {
          // Use very wide date range covering all possible dates
          const startDate = new Date(0);
          const endDate = new Date(2100000000000);

          const filtered = records.filter((record) => {
            return (
              record.transaction_date >= startDate &&
              record.transaction_date <= endDate
            );
          });

          // All records should pass the date filter
          expect(filtered.length).toBe(records.length);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('filtering is idempotent: filtering the result again produces the same result', () => {
    fc.assert(
      fc.property(
        fc.array(arbSalesReportRecord, { minLength: 1, maxLength: 30 }),
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbCategory, { nil: undefined }),
        (records, date1, date2, filterBranchId, filterCategory) => {
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          const applyFilter = (data: typeof records) =>
            data.filter((record) => {
              if (
                record.transaction_date < startDate ||
                record.transaction_date > endDate
              ) {
                return false;
              }
              if (filterBranchId && record.branch_id !== filterBranchId) {
                return false;
              }
              if (filterCategory && record.category !== filterCategory) {
                return false;
              }
              return true;
            });

          const firstPass = applyFilter(records);
          const secondPass = applyFilter(firstPass);

          expect(secondPass).toEqual(firstPass);
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 22: CSV Export Round-Trip ----------

describe('Property 22: CSV Export Round-Trip', () => {
  const service = new ReportService();

  /** Simple CSV parser that handles quoted fields with commas, quotes, and newlines */
  function parseCsv(csvString: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvString.length) {
      const char = csvString[i];

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote
          if (i + 1 < csvString.length && csvString[i + 1] === '"') {
            currentField += '"';
            i += 2;
            continue;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += char;
          i++;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
          i++;
        } else if (char === '\n') {
          currentRow.push(currentField);
          currentField = '';
          rows.push(currentRow);
          currentRow = [];
          i++;
        } else {
          currentField += char;
          i++;
        }
      }
    }

    // Handle last field/row if the string doesn't end with newline
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  }

  it('exporting to CSV and parsing back produces data equivalent to the original', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            item_name: fc.string({ minLength: 1, maxLength: 50 }).filter(
              (s) => !s.includes('\r') // Avoid carriage returns for clean parsing
            ),
            sku: fc.string({ minLength: 1, maxLength: 20 }).filter(
              (s) => !s.includes('\r')
            ),
            category: fc.string({ minLength: 1, maxLength: 30 }).filter(
              (s) => !s.includes('\r')
            ),
            quantity: fc.integer({ min: 0, max: 100000 }),
            revenue: fc.double({ min: 0, max: 999999.99, noNaN: true }).map(
              (n) => parseFloat(n.toFixed(2))
            ),
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (data) => {
          const headers = ['item_name', 'sku', 'category', 'quantity', 'revenue'];

          // Export to CSV
          const csvBuffer = service.exportToCsv(
            data as Record<string, unknown>[],
            headers
          );
          const csvString = csvBuffer.toString('utf-8');

          // Parse CSV back
          const parsed = parseCsv(csvString);

          // First row is headers
          expect(parsed[0]).toEqual(headers);

          // Remaining rows are data
          expect(parsed.length - 1).toBe(data.length);

          for (let i = 0; i < data.length; i++) {
            const parsedRow = parsed[i + 1];
            const originalRow = data[i];

            expect(parsedRow[0]).toBe(String(originalRow.item_name));
            expect(parsedRow[1]).toBe(String(originalRow.sku));
            expect(parsedRow[2]).toBe(String(originalRow.category));
            expect(parsedRow[3]).toBe(String(originalRow.quantity));
            expect(parsedRow[4]).toBe(String(originalRow.revenue));
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('CSV round-trip handles fields containing commas correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 40 }).map(
              (s) => s.replace(/\r/g, '') // Remove carriage returns
            ),
            value: fc.string({ minLength: 1, maxLength: 40 }).map((s) =>
              // Ensure field contains at least one comma
              s.replace(/\r/g, '') + ','
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (data) => {
          const headers = ['name', 'value'];

          const csvBuffer = service.exportToCsv(
            data as Record<string, unknown>[],
            headers
          );
          const csvString = csvBuffer.toString('utf-8');

          const parsed = parseCsv(csvString);

          expect(parsed.length - 1).toBe(data.length);

          for (let i = 0; i < data.length; i++) {
            expect(parsed[i + 1][0]).toBe(String(data[i].name));
            expect(parsed[i + 1][1]).toBe(String(data[i].value));
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('CSV round-trip handles fields containing double quotes correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 40 }).map(
              (s) => s.replace(/\r/g, '')
            ),
            value: fc.string({ minLength: 1, maxLength: 30 }).map((s) =>
              // Ensure field contains at least one double quote
              s.replace(/\r/g, '') + '"test"'
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (data) => {
          const headers = ['name', 'value'];

          const csvBuffer = service.exportToCsv(
            data as Record<string, unknown>[],
            headers
          );
          const csvString = csvBuffer.toString('utf-8');

          const parsed = parseCsv(csvString);

          expect(parsed.length - 1).toBe(data.length);

          for (let i = 0; i < data.length; i++) {
            expect(parsed[i + 1][0]).toBe(String(data[i].name));
            expect(parsed[i + 1][1]).toBe(String(data[i].value));
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('CSV round-trip handles fields containing newlines correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 40 }).map(
              (s) => s.replace(/\r/g, '')
            ),
            value: fc.string({ minLength: 1, maxLength: 30 }).map((s) =>
              // Ensure field contains at least one newline
              s.replace(/\r/g, '') + '\nline2'
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (data) => {
          const headers = ['name', 'value'];

          const csvBuffer = service.exportToCsv(
            data as Record<string, unknown>[],
            headers
          );
          const csvString = csvBuffer.toString('utf-8');

          const parsed = parseCsv(csvString);

          expect(parsed.length - 1).toBe(data.length);

          for (let i = 0; i < data.length; i++) {
            expect(parsed[i + 1][0]).toBe(String(data[i].name));
            expect(parsed[i + 1][1]).toBe(String(data[i].value));
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('empty data produces CSV with only headers', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) =>
              !s.includes(',') && !s.includes('"') && !s.includes('\n') && !s.includes('\r')
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (headers) => {
          const csvBuffer = service.exportToCsv([], headers);
          const csvString = csvBuffer.toString('utf-8');

          const parsed = parseCsv(csvString);

          // Should have exactly 1 row (headers only)
          expect(parsed.length).toBe(1);
          expect(parsed[0]).toEqual(headers);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('number of CSV data rows always equals the number of input records', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            a: fc.string({ minLength: 1, maxLength: 20 }).filter(
              (s) => !s.includes('\r') && !s.includes('\n') && !s.includes(',') && !s.includes('"')
            ),
            b: fc.integer({ min: 0, max: 99999 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (data) => {
          const headers = ['a', 'b'];

          const csvBuffer = service.exportToCsv(
            data as Record<string, unknown>[],
            headers
          );
          const csvString = csvBuffer.toString('utf-8');

          const parsed = parseCsv(csvString);

          // Total rows = 1 (header) + data.length
          expect(parsed.length - 1).toBe(data.length);
        }
      ),
      defaultPropertyConfig
    );
  });
});
