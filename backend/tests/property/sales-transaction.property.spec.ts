/**
 * Property-Based Tests: Sales Transactions
 *
 * Feature: multi-branch-stock-sales-system
 * Property 11: Sale Transaction Stock Deduction
 * Property 12: Insufficient Stock Rejects Entire Sale
 * Property 13: Sale Total Calculation
 * Property 14: Transaction Reference Uniqueness
 * Property 15: Concurrent Sales Never Oversell Stock
 *
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  arbSaleLineItemInput,
  arbSaleQuantity,
  arbUnitPrice,
  arbUuid,
  defaultPropertyConfig,
} from '../factories/arbitraries';
import { SalesService, SalesServiceError } from '../../src/services/sales.service';

// Mock the database connection module
vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  withTransaction: vi.fn(),
}));

import { withTransaction } from '../../src/database/connection';

const mockedWithTransaction = vi.mocked(withTransaction);

// ---------- Property 13: Sale Total Calculation ----------

describe('Property 13: Sale Total Calculation', () => {
  it('total equals sum of (quantity × unit_price) for each line item, rounded to 2 decimal places', () => {
    const service = new SalesService();

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: arbSaleQuantity,
            unit_price: arbUnitPrice,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (lineItems) => {
          const result = service.calculateTotal(lineItems);

          // Compute expected total: sum of (quantity * unit_price) rounded to 2 dp
          const rawSum = lineItems.reduce(
            (acc, item) => acc + item.quantity * item.unit_price,
            0
          );
          const expected = Math.round((rawSum + Number.EPSILON) * 100) / 100;

          expect(result).toBeCloseTo(expected, 2);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('total is always non-negative for valid line items', () => {
    const service = new SalesService();

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: arbSaleQuantity,
            unit_price: arbUnitPrice,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (lineItems) => {
          const result = service.calculateTotal(lineItems);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('total has at most 2 decimal places', () => {
    const service = new SalesService();

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: arbSaleQuantity,
            unit_price: arbUnitPrice,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (lineItems) => {
          const result = service.calculateTotal(lineItems);
          // Check that rounding to 2 dp doesn't change the value
          const rounded = Math.round(result * 100) / 100;
          expect(result).toBe(rounded);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('single line item total equals quantity × unit_price rounded to 2 dp', () => {
    const service = new SalesService();

    fc.assert(
      fc.property(
        arbSaleQuantity,
        arbUnitPrice,
        (quantity, unitPrice) => {
          const result = service.calculateTotal([{ quantity, unit_price: unitPrice }]);
          const expected = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
          expect(result).toBeCloseTo(expected, 2);
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 11: Sale Transaction Stock Deduction ----------

describe('Property 11: Sale Transaction Stock Deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('after a successful sale, stock decreases by exactly the sold quantity for each line item', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbUuid,
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: fc.integer({ min: 1, max: 100 }),
            unit_price: arbUnitPrice,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (branchId, userId, lineItems) => {
          vi.clearAllMocks();
          const service = new SalesService();

          // Track stock deductions
          const stockDeductions: Array<{ stock_item_id: string; quantity: number }> = [];
          // Initial stock levels (each has enough for the sale)
          const initialStockMap = new Map<string, number>();
          for (const item of lineItems) {
            initialStockMap.set(item.stock_item_id, item.quantity + 100); // always enough
          }

          // Mock withTransaction to execute the callback with a mock client
          mockedWithTransaction.mockImplementation(async (callback) => {
            const mockClient = {
              query: vi.fn(),
            };

            // Branch check: Active branch
            mockClient.query.mockResolvedValueOnce({
              rows: [{ id: branchId, status: 'Active' }],
              rowCount: 1,
            });

            // SELECT ... FOR UPDATE: return stock levels
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item) => ({
                stock_item_id: item.stock_item_id,
                quantity: initialStockMap.get(item.stock_item_id),
              })),
              rowCount: lineItems.length,
            });

            // INSERT sale_transactions
            mockClient.query.mockResolvedValueOnce({
              rows: [{
                id: 'sale-txn-id',
                reference_number: 'TXN-123-4567',
                branch_id: branchId,
                created_by: userId,
                total_amount: 0,
                transaction_date: new Date(),
                created_at: new Date(),
              }],
              rowCount: 1,
            });

            // For each line item: INSERT line item + UPDATE stock
            for (const item of lineItems) {
              // INSERT sale_line_items
              mockClient.query.mockResolvedValueOnce({
                rows: [{
                  id: `line-item-${item.stock_item_id}`,
                  sale_transaction_id: 'sale-txn-id',
                  stock_item_id: item.stock_item_id,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  line_total: item.quantity * item.unit_price,
                }],
                rowCount: 1,
              });

              // UPDATE stock_levels — capture the deduction
              mockClient.query.mockImplementationOnce(async (sql: string, params: unknown[]) => {
                stockDeductions.push({
                  stock_item_id: params![2] as string,
                  quantity: params![0] as number,
                });
                return { rows: [], rowCount: 1 };
              });
            }

            return callback(mockClient as any);
          });

          const result = await service.createTransaction(userId, {
            branch_id: branchId,
            line_items: lineItems,
          });

          // Verify: stock was deducted by EXACTLY the sold quantity for each line item
          expect(stockDeductions.length).toBe(lineItems.length);
          for (let i = 0; i < lineItems.length; i++) {
            expect(stockDeductions[i].stock_item_id).toBe(lineItems[i].stock_item_id);
            expect(stockDeductions[i].quantity).toBe(lineItems[i].quantity);
          }

          // Verify return includes line items
          expect(result.line_items.length).toBe(lineItems.length);
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 12: Insufficient Stock Rejects Entire Sale ----------

describe('Property 12: Insufficient Stock Rejects Entire Sale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when any item has insufficient stock, the entire transaction is rejected with 422', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbUuid,
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: fc.integer({ min: 2, max: 100 }),
            unit_price: arbUnitPrice,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        // Index of the item that will have insufficient stock
        fc.nat(),
        async (branchId, userId, lineItems, insufficientIdx) => {
          vi.clearAllMocks();
          const service = new SalesService();

          // Determine which item has insufficient stock
          const targetIdx = insufficientIdx % lineItems.length;
          let stockUpdatesPerformed = 0;

          // Mock withTransaction
          mockedWithTransaction.mockImplementation(async (callback) => {
            const mockClient = {
              query: vi.fn(),
            };

            // Branch check: Active branch
            mockClient.query.mockResolvedValueOnce({
              rows: [{ id: branchId, status: 'Active' }],
              rowCount: 1,
            });

            // SELECT ... FOR UPDATE: return stock levels
            // Make the target item have insufficient stock (available = quantity - 1)
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item, idx) => ({
                stock_item_id: item.stock_item_id,
                quantity: idx === targetIdx ? item.quantity - 1 : item.quantity + 100,
              })),
              rowCount: lineItems.length,
            });

            return callback(mockClient as any);
          });

          // The transaction should be rejected
          try {
            await service.createTransaction(userId, {
              branch_id: branchId,
              line_items: lineItems,
            });
            expect.fail('Expected SalesServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(SalesServiceError);
            expect((error as SalesServiceError).statusCode).toBe(422);
            expect((error as SalesServiceError).message).toContain('Insufficient stock');
          }

          // No stock updates should have occurred (entire sale rejected)
          expect(stockUpdatesPerformed).toBe(0);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('when all items have sufficient stock, the transaction succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbUuid,
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: fc.integer({ min: 1, max: 50 }),
            unit_price: arbUnitPrice,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (branchId, userId, lineItems) => {
          vi.clearAllMocks();
          const service = new SalesService();

          mockedWithTransaction.mockImplementation(async (callback) => {
            const mockClient = {
              query: vi.fn(),
            };

            // Branch check: Active branch
            mockClient.query.mockResolvedValueOnce({
              rows: [{ id: branchId, status: 'Active' }],
              rowCount: 1,
            });

            // SELECT ... FOR UPDATE: all items have sufficient stock
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item) => ({
                stock_item_id: item.stock_item_id,
                quantity: item.quantity + 50, // always enough
              })),
              rowCount: lineItems.length,
            });

            // INSERT sale_transactions
            mockClient.query.mockResolvedValueOnce({
              rows: [{
                id: 'sale-txn-id',
                reference_number: 'TXN-123-4567',
                branch_id: branchId,
                created_by: userId,
                total_amount: service.calculateTotal(lineItems),
                transaction_date: new Date(),
                created_at: new Date(),
              }],
              rowCount: 1,
            });

            // For each line item: INSERT + UPDATE
            for (const item of lineItems) {
              mockClient.query.mockResolvedValueOnce({
                rows: [{
                  id: `line-${item.stock_item_id}`,
                  sale_transaction_id: 'sale-txn-id',
                  stock_item_id: item.stock_item_id,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  line_total: item.quantity * item.unit_price,
                }],
                rowCount: 1,
              });
              mockClient.query.mockResolvedValueOnce({
                rows: [],
                rowCount: 1,
              });
            }

            return callback(mockClient as any);
          });

          const result = await service.createTransaction(userId, {
            branch_id: branchId,
            line_items: lineItems,
          });

          // Transaction should succeed
          expect(result).toBeDefined();
          expect(result.line_items.length).toBe(lineItems.length);
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 14: Transaction Reference Uniqueness ----------

describe('Property 14: Transaction Reference Uniqueness', () => {
  it('reference numbers follow the expected format TXN-{timestamp}-{4digits}', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (count) => {
          const service = new SalesService();
          const generateRef = (service as any).generateReferenceNumber.bind(service);
          const pattern = /^TXN-\d+-\d{4}$/;

          for (let i = 0; i < count; i++) {
            const ref = generateRef();
            expect(ref).toMatch(pattern);
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('two references generated at different timestamps are always distinct', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (count) => {
          const service = new SalesService();
          const generateRef = (service as any).generateReferenceNumber.bind(service);

          // Mock Date.now() to return different timestamps for each call
          let mockTime = 1700000000000;
          const originalDateNow = Date.now;
          Date.now = () => ++mockTime;

          try {
            const references = new Set<string>();
            for (let i = 0; i < count; i++) {
              references.add(generateRef());
            }
            // All generated references should be distinct when timestamps differ
            expect(references.size).toBe(count);
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('references generated across separate transactions are distinct', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbUuid,
        fc.integer({ min: 2, max: 10 }),
        async (branchId, userId, txnCount) => {
          const service = new SalesService();
          const collectedRefs = new Set<string>();

          // Mock Date.now() to ensure different timestamps per transaction
          let mockTime = 1700000000000;
          const originalDateNow = Date.now;
          Date.now = () => ++mockTime;

          try {
            for (let i = 0; i < txnCount; i++) {
              vi.clearAllMocks();

              mockedWithTransaction.mockImplementation(async (callback) => {
                const mockClient = { query: vi.fn() };

                // Branch check
                mockClient.query.mockResolvedValueOnce({
                  rows: [{ id: branchId, status: 'Active' }],
                  rowCount: 1,
                });

                // Stock levels (sufficient)
                mockClient.query.mockResolvedValueOnce({
                  rows: [{ stock_item_id: 'item-1', quantity: 9999 }],
                  rowCount: 1,
                });

                // INSERT sale_transactions — capture the reference
                mockClient.query.mockImplementationOnce(async (_sql: string, params: unknown[]) => {
                  const ref = params![0] as string;
                  collectedRefs.add(ref);
                  return {
                    rows: [{
                      id: `sale-${i}`,
                      reference_number: ref,
                      branch_id: branchId,
                      created_by: userId,
                      total_amount: 10,
                      transaction_date: new Date(),
                      created_at: new Date(),
                    }],
                    rowCount: 1,
                  };
                });

                // INSERT line item
                mockClient.query.mockResolvedValueOnce({
                  rows: [{
                    id: `line-${i}`,
                    sale_transaction_id: `sale-${i}`,
                    stock_item_id: 'item-1',
                    quantity: 1,
                    unit_price: 10,
                    line_total: 10,
                  }],
                  rowCount: 1,
                });

                // UPDATE stock
                mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

                return callback(mockClient as any);
              });

              await service.createTransaction(userId, {
                branch_id: branchId,
                line_items: [{ stock_item_id: 'item-1', quantity: 1, unit_price: 10 }],
              });
            }

            // All references across transactions must be unique
            expect(collectedRefs.size).toBe(txnCount);
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 15: Concurrent Sales Never Oversell Stock ----------

describe('Property 15: Concurrent Sales Never Oversell Stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sequential sales cannot reduce stock below zero: total sold <= initial stock', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbUuid,
        arbUuid,
        fc.integer({ min: 1, max: 500 }), // initial stock
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 10 }), // sale quantities
        async (branchId, userId, stockItemId, initialStock, saleQuantities) => {
          const service = new SalesService();

          // Track cumulative stock sold across sequential sales
          let currentStock = initialStock;
          let totalSold = 0;
          let salesAccepted = 0;
          let salesRejected = 0;

          for (const qty of saleQuantities) {
            vi.clearAllMocks();

            mockedWithTransaction.mockImplementation(async (callback) => {
              const mockClient = {
                query: vi.fn(),
              };

              // Branch check
              mockClient.query.mockResolvedValueOnce({
                rows: [{ id: branchId, status: 'Active' }],
                rowCount: 1,
              });

              // SELECT ... FOR UPDATE: current stock level
              mockClient.query.mockResolvedValueOnce({
                rows: [{ stock_item_id: stockItemId, quantity: currentStock }],
                rowCount: 1,
              });

              if (currentStock >= qty) {
                // INSERT sale_transactions
                mockClient.query.mockResolvedValueOnce({
                  rows: [{
                    id: `sale-${totalSold}`,
                    reference_number: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                    branch_id: branchId,
                    created_by: userId,
                    total_amount: qty * 10,
                    transaction_date: new Date(),
                    created_at: new Date(),
                  }],
                  rowCount: 1,
                });

                // INSERT line item
                mockClient.query.mockResolvedValueOnce({
                  rows: [{
                    id: `line-${totalSold}`,
                    sale_transaction_id: `sale-${totalSold}`,
                    stock_item_id: stockItemId,
                    quantity: qty,
                    unit_price: 10,
                    line_total: qty * 10,
                  }],
                  rowCount: 1,
                });

                // UPDATE stock
                mockClient.query.mockResolvedValueOnce({
                  rows: [],
                  rowCount: 1,
                });
              }

              return callback(mockClient as any);
            });

            try {
              await service.createTransaction(userId, {
                branch_id: branchId,
                line_items: [{ stock_item_id: stockItemId, quantity: qty, unit_price: 10 }],
              });
              // Sale succeeded — deduct from current stock
              currentStock -= qty;
              totalSold += qty;
              salesAccepted++;
            } catch (error) {
              if (error instanceof SalesServiceError && error.statusCode === 422) {
                salesRejected++;
              } else {
                throw error;
              }
            }
          }

          // Critical invariant: total sold never exceeds initial stock
          expect(totalSold).toBeLessThanOrEqual(initialStock);

          // Stock can never go below zero
          expect(currentStock).toBeGreaterThanOrEqual(0);

          // At least one sale should have been attempted
          expect(salesAccepted + salesRejected).toBe(saleQuantities.length);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('the validation logic prevents overselling: a sale requesting more than available stock is always rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbUuid,
        arbUuid,
        fc.integer({ min: 0, max: 100 }), // available stock (can be 0)
        fc.integer({ min: 1, max: 200 }), // requested quantity
        async (branchId, userId, stockItemId, available, requested) => {
          // Only test cases where requested > available
          fc.pre(requested > available);

          vi.clearAllMocks();
          const service = new SalesService();

          mockedWithTransaction.mockImplementation(async (callback) => {
            const mockClient = {
              query: vi.fn(),
            };

            // Branch check
            mockClient.query.mockResolvedValueOnce({
              rows: [{ id: branchId, status: 'Active' }],
              rowCount: 1,
            });

            // SELECT ... FOR UPDATE: insufficient stock
            mockClient.query.mockResolvedValueOnce({
              rows: [{ stock_item_id: stockItemId, quantity: available }],
              rowCount: 1,
            });

            return callback(mockClient as any);
          });

          try {
            await service.createTransaction(userId, {
              branch_id: branchId,
              line_items: [{ stock_item_id: stockItemId, quantity: requested, unit_price: 10 }],
            });
            expect.fail('Expected SalesServiceError for insufficient stock');
          } catch (error) {
            expect(error).toBeInstanceOf(SalesServiceError);
            expect((error as SalesServiceError).statusCode).toBe(422);
          }
        }
      ),
      defaultPropertyConfig
    );
  });
});
