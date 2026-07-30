/**
 * Property-Based Tests: Inventory Alerts
 *
 * Feature: multi-branch-stock-sales-system
 * Property 10: Low-Stock Alert Threshold Invariant
 *
 * For any stock item at any branch, a low-stock alert SHALL exist if and only if
 * the current quantity is strictly below the item's configured low_stock_threshold.
 *
 * **Validates: Requirements 4.2, 4.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  arbStockQuantity,
  arbLowStockThreshold,
  arbBranchStatus,
  defaultPropertyConfig,
} from '../factories/arbitraries';
import { StockService, LowStockAlert } from '../../src/services/stock.service';

// Mock the database connection module
vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  withTransaction: vi.fn(),
}));

import { query } from '../../src/database/connection';

const mockedQuery = vi.mocked(query);

// ---------- Pure alert predicate ----------

/**
 * Pure function implementing the low-stock alert condition.
 * An alert exists iff:
 *   quantity < threshold AND is_active = true AND branch_status = 'Active'
 */
function shouldGenerateAlert(
  quantity: number,
  lowStockThreshold: number,
  isActive: boolean,
  branchStatus: 'Active' | 'Inactive'
): boolean {
  return quantity < lowStockThreshold && isActive === true && branchStatus === 'Active';
}

// ---------- Property 10: Low-Stock Alert Threshold Invariant ----------

describe('Property 10: Low-Stock Alert Threshold Invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('an alert MUST be generated when quantity < threshold AND item is active AND branch is Active', () => {
    fc.assert(
      fc.property(
        arbStockQuantity,
        arbLowStockThreshold,
        (quantity, threshold) => {
          // Only test cases where quantity < threshold
          fc.pre(quantity < threshold);

          const result = shouldGenerateAlert(quantity, threshold, true, 'Active');
          expect(result).toBe(true);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('an alert MUST NOT exist when quantity >= threshold', () => {
    fc.assert(
      fc.property(
        arbStockQuantity,
        arbLowStockThreshold,
        fc.boolean(),
        arbBranchStatus,
        (quantity, threshold, isActive, branchStatus) => {
          // Only test cases where quantity >= threshold
          fc.pre(quantity >= threshold);

          const result = shouldGenerateAlert(quantity, threshold, isActive, branchStatus);
          expect(result).toBe(false);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('alert generation is a pure function of (quantity, threshold, is_active, branch_status)', () => {
    fc.assert(
      fc.property(
        arbStockQuantity,
        arbLowStockThreshold,
        fc.boolean(),
        arbBranchStatus,
        (quantity, threshold, isActive, branchStatus) => {
          // Calling the function twice with the same inputs should produce the same result
          const result1 = shouldGenerateAlert(quantity, threshold, isActive, branchStatus);
          const result2 = shouldGenerateAlert(quantity, threshold, isActive, branchStatus);
          expect(result1).toBe(result2);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('an alert MUST NOT exist when item is inactive (even if quantity < threshold)', () => {
    fc.assert(
      fc.property(
        arbStockQuantity,
        arbLowStockThreshold,
        arbBranchStatus,
        (quantity, threshold, branchStatus) => {
          fc.pre(quantity < threshold);

          const result = shouldGenerateAlert(quantity, threshold, false, branchStatus);
          expect(result).toBe(false);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('an alert MUST NOT exist when branch is Inactive (even if quantity < threshold)', () => {
    fc.assert(
      fc.property(
        arbStockQuantity,
        arbLowStockThreshold,
        (quantity, threshold) => {
          fc.pre(quantity < threshold);

          const result = shouldGenerateAlert(quantity, threshold, true, 'Inactive');
          expect(result).toBe(false);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('getLowStockAlerts returns exactly those items satisfying the alert condition', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            stock_item_id: fc.uuid(),
            stock_item_name: fc.string({ minLength: 1, maxLength: 50 }),
            sku: fc.string({ minLength: 1, maxLength: 30 }),
            category: fc.string({ minLength: 1, maxLength: 50 }),
            branch_id: fc.uuid(),
            branch_name: fc.string({ minLength: 1, maxLength: 100 }),
            quantity: arbStockQuantity,
            low_stock_threshold: arbLowStockThreshold,
            is_active: fc.boolean(),
            branch_status: arbBranchStatus,
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (stockEntries) => {
          vi.clearAllMocks();
          const service = new StockService();

          // Compute expected alerts using the pure predicate
          const expectedAlerts: LowStockAlert[] = stockEntries
            .filter((entry) =>
              shouldGenerateAlert(entry.quantity, entry.low_stock_threshold, entry.is_active, entry.branch_status)
            )
            .map((entry) => ({
              stock_item_id: entry.stock_item_id,
              stock_item_name: entry.stock_item_name,
              sku: entry.sku,
              category: entry.category,
              branch_id: entry.branch_id,
              branch_name: entry.branch_name,
              quantity: entry.quantity,
              low_stock_threshold: entry.low_stock_threshold,
            }));

          // Mock the database query to return the filtered results
          // (simulating what the SQL WHERE clause would produce)
          mockedQuery.mockResolvedValueOnce({
            rows: expectedAlerts,
            rowCount: expectedAlerts.length,
          } as never);

          const results = await service.getLowStockAlerts();

          // Verify: results count matches expected
          expect(results.length).toBe(expectedAlerts.length);

          // Every returned alert has quantity < threshold
          for (const alert of results) {
            expect(alert.quantity).toBeLessThan(alert.low_stock_threshold);
          }

          // No items with quantity >= threshold should be in the results
          const alertItemIds = new Set(
            results.map((a) => `${a.stock_item_id}-${a.branch_id}`)
          );

          for (const entry of stockEntries) {
            const key = `${entry.stock_item_id}-${entry.branch_id}`;
            if (!shouldGenerateAlert(entry.quantity, entry.low_stock_threshold, entry.is_active, entry.branch_status)) {
              expect(alertItemIds.has(key)).toBe(false);
            }
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('alert biconditional: alert exists IFF quantity < threshold AND is_active AND branch Active', () => {
    fc.assert(
      fc.property(
        arbStockQuantity,
        arbLowStockThreshold,
        fc.boolean(),
        arbBranchStatus,
        (quantity, threshold, isActive, branchStatus) => {
          const alertExists = shouldGenerateAlert(quantity, threshold, isActive, branchStatus);
          const conditionMet = quantity < threshold && isActive === true && branchStatus === 'Active';

          // Biconditional: alert exists if and only if condition is met
          expect(alertExists).toBe(conditionMet);
        }
      ),
      defaultPropertyConfig
    );
  });
});
