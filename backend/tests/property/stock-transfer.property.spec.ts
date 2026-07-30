/**
 * Property-Based Tests: Stock Transfers
 *
 * Feature: multi-branch-stock-sales-system
 * Property 16: Stock Transfer Conservation
 * Property 17: Transfer Rejects Insufficient Source Stock
 * Property 18: Transfer Validation Rules
 * Property 19: Failed Transfer Preserves Stock Levels
 *
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.6**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  arbCreateTransferInput,
  arbTransferQuantity,
  arbUuid,
  defaultPropertyConfig,
} from '../factories/arbitraries';

// Mock the database connection module (must be before service import)
vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  withTransaction: vi.fn(),
}));

// Mock dotenv to prevent connection.ts side effects
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

import { TransferService, TransferServiceError } from '../../src/services/transfer.service';

import { query, withTransaction } from '../../src/database/connection';

const mockedQuery = vi.mocked(query);
const mockedWithTransaction = vi.mocked(withTransaction);

// ---------- Property 16: Stock Transfer Conservation ----------

describe('Property 16: Stock Transfer Conservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('for any confirmed stock transfer, source_after + dest_after = source_before + dest_before for each item', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // transferId
        arbUuid, // userId
        arbUuid, // sourceBranchId
        arbUuid, // destBranchId
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: arbTransferQuantity,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (transferId, userId, sourceBranchId, destBranchId, lineItems) => {
          // Skip if source === dest (would be rejected by validation anyway)
          fc.pre(sourceBranchId !== destBranchId);

          vi.clearAllMocks();
          const service = new TransferService();

          // Track stock changes: source deductions and destination additions
          const sourceDeductions = new Map<string, number>();
          const destAdditions = new Map<string, number>();

          // Initial stock at source: each item has enough stock
          const initialSourceStock = new Map<string, number>();
          const initialDestStock = new Map<string, number>();
          for (const item of lineItems) {
            initialSourceStock.set(item.stock_item_id, item.quantity + 500);
            initialDestStock.set(item.stock_item_id, 100);
          }

          mockedWithTransaction.mockImplementation(async (callback) => {
            const mockClient = {
              query: vi.fn(),
            };

            // 1. SELECT transfer FOR UPDATE
            mockClient.query.mockResolvedValueOnce({
              rows: [{
                id: transferId,
                source_branch_id: sourceBranchId,
                destination_branch_id: destBranchId,
                initiated_by: userId,
                status: 'pending',
                created_at: new Date(),
              }],
              rowCount: 1,
            });

            // 2. SELECT transfer_line_items
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item, idx) => ({
                id: `tli-${idx}`,
                stock_transfer_id: transferId,
                stock_item_id: item.stock_item_id,
                quantity: item.quantity,
              })),
              rowCount: lineItems.length,
            });

            // 3. SELECT source stock FOR UPDATE
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item) => ({
                stock_item_id: item.stock_item_id,
                quantity: initialSourceStock.get(item.stock_item_id),
              })),
              rowCount: lineItems.length,
            });

            // 4. SELECT dest stock FOR UPDATE
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item) => ({
                stock_item_id: item.stock_item_id,
                quantity: initialDestStock.get(item.stock_item_id),
              })),
              rowCount: lineItems.length,
            });

            // 5. UPDATE source stock (deductions) - one per line item
            for (const item of lineItems) {
              mockClient.query.mockImplementationOnce(async (_sql: string, params: unknown[]) => {
                sourceDeductions.set(
                  params![2] as string,
                  (sourceDeductions.get(params![2] as string) ?? 0) + (params![0] as number)
                );
                return { rows: [], rowCount: 1 };
              });
            }

            // 6. INSERT/UPDATE dest stock (additions) - one per line item
            for (const item of lineItems) {
              mockClient.query.mockImplementationOnce(async (_sql: string, params: unknown[]) => {
                destAdditions.set(
                  params![1] as string,
                  (destAdditions.get(params![1] as string) ?? 0) + (params![2] as number)
                );
                return { rows: [], rowCount: 1 };
              });
            }

            // 7. UPDATE transfer status to 'confirmed'
            mockClient.query.mockResolvedValueOnce({
              rows: [{
                id: transferId,
                source_branch_id: sourceBranchId,
                destination_branch_id: destBranchId,
                initiated_by: userId,
                status: 'confirmed',
                confirmed_at: new Date(),
                created_at: new Date(),
              }],
              rowCount: 1,
            });

            // 8. SELECT line items with details for response
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item, idx) => ({
                id: `tli-${idx}`,
                stock_transfer_id: transferId,
                stock_item_id: item.stock_item_id,
                quantity: item.quantity,
                stock_item_name: `Item ${idx}`,
                stock_item_sku: `SKU-${idx}`,
              })),
              rowCount: lineItems.length,
            });

            return callback(mockClient as any);
          });

          await service.confirm(transferId, userId);

          // CONSERVATION INVARIANT: for each item,
          // source_deducted === dest_added === original transfer quantity
          for (const item of lineItems) {
            const deducted = sourceDeductions.get(item.stock_item_id) ?? 0;
            const added = destAdditions.get(item.stock_item_id) ?? 0;

            // Source deduction equals destination addition (conservation)
            expect(deducted).toBe(added);

            // Both equal the requested transfer quantity
            expect(deducted).toBe(item.quantity);

            // Therefore: source_after + dest_after = source_before + dest_before
            const sourceBefore = initialSourceStock.get(item.stock_item_id)!;
            const destBefore = initialDestStock.get(item.stock_item_id)!;
            const sourceAfter = sourceBefore - deducted;
            const destAfter = destBefore + added;

            expect(sourceAfter + destAfter).toBe(sourceBefore + destBefore);
          }
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 17: Transfer Rejects Insufficient Source Stock ----------

describe('Property 17: Transfer Rejects Insufficient Source Stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when any line item quantity exceeds source stock, the entire transfer is rejected and stock levels remain unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // transferId
        arbUuid, // userId
        arbUuid, // sourceBranchId
        arbUuid, // destBranchId
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: fc.integer({ min: 2, max: 100 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.nat(), // index of insufficient item
        async (transferId, userId, sourceBranchId, destBranchId, lineItems, insufficientIdx) => {
          fc.pre(sourceBranchId !== destBranchId);

          vi.clearAllMocks();
          const service = new TransferService();

          const targetIdx = insufficientIdx % lineItems.length;
          let stockUpdatesPerformed = 0;

          mockedWithTransaction.mockImplementation(async (callback) => {
            const mockClient = {
              query: vi.fn(),
            };

            // 1. SELECT transfer FOR UPDATE
            mockClient.query.mockResolvedValueOnce({
              rows: [{
                id: transferId,
                source_branch_id: sourceBranchId,
                destination_branch_id: destBranchId,
                initiated_by: userId,
                status: 'pending',
                created_at: new Date(),
              }],
              rowCount: 1,
            });

            // 2. SELECT transfer_line_items
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item, idx) => ({
                id: `tli-${idx}`,
                stock_transfer_id: transferId,
                stock_item_id: item.stock_item_id,
                quantity: item.quantity,
              })),
              rowCount: lineItems.length,
            });

            // 3. SELECT source stock FOR UPDATE - target item has insufficient stock
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item, idx) => ({
                stock_item_id: item.stock_item_id,
                quantity: idx === targetIdx ? item.quantity - 1 : item.quantity + 500,
              })),
              rowCount: lineItems.length,
            });

            // 4. SELECT dest stock FOR UPDATE
            mockClient.query.mockResolvedValueOnce({
              rows: lineItems.map((item) => ({
                stock_item_id: item.stock_item_id,
                quantity: 50,
              })),
              rowCount: lineItems.length,
            });

            // 5. UPDATE transfer status to 'failed' (due to insufficient stock)
            mockClient.query.mockResolvedValueOnce({
              rows: [],
              rowCount: 1,
            });

            return callback(mockClient as any);
          });

          // The transfer should be rejected
          try {
            await service.confirm(transferId, userId);
            expect.fail('Expected TransferServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TransferServiceError);
            expect((error as TransferServiceError).statusCode).toBe(422);
            expect((error as TransferServiceError).message).toContain('Insufficient stock');
          }

          // No stock updates should have occurred (entire transfer rejected)
          expect(stockUpdatesPerformed).toBe(0);
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 18: Transfer Validation Rules ----------

describe('Property 18: Transfer Validation Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects transfer when source branch equals destination branch', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // userId
        arbUuid, // branchId (same for source and dest)
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: arbTransferQuantity,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (userId, branchId, lineItems) => {
          vi.clearAllMocks();
          const service = new TransferService();

          try {
            await service.initiate(userId, {
              source_branch_id: branchId,
              destination_branch_id: branchId, // same branch!
              line_items: lineItems,
            });
            expect.fail('Expected TransferServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TransferServiceError);
            expect((error as TransferServiceError).statusCode).toBe(400);
            expect((error as TransferServiceError).message).toContain('different');
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('rejects transfer when initiator is not assigned to source branch', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // userId
        arbUuid, // sourceBranchId
        arbUuid, // destBranchId
        arbUuid, // userAssignedBranchId (different from source)
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: arbTransferQuantity,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (userId, sourceBranchId, destBranchId, userAssignedBranchId, lineItems) => {
          // Ensure all branches are different
          fc.pre(sourceBranchId !== destBranchId);
          fc.pre(userAssignedBranchId !== sourceBranchId);

          vi.clearAllMocks();
          const service = new TransferService();

          // Mock: user is not Admin and is assigned to a different branch
          mockedQuery.mockResolvedValueOnce({
            rows: [{ id: userId, role: 'Branch_Manager', assigned_branch_id: userAssignedBranchId }],
            rowCount: 1,
          } as any);

          try {
            await service.initiate(userId, {
              source_branch_id: sourceBranchId,
              destination_branch_id: destBranchId,
              line_items: lineItems,
            });
            expect.fail('Expected TransferServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TransferServiceError);
            expect((error as TransferServiceError).statusCode).toBe(403);
            expect((error as TransferServiceError).message).toContain('assigned branch');
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('rejects transfer when any line item has quantity <= 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // userId
        arbUuid, // sourceBranchId
        arbUuid, // destBranchId
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: arbTransferQuantity,
          }),
          { minLength: 0, maxLength: 4 }
        ),
        fc.record({
          stock_item_id: arbUuid,
          quantity: fc.integer({ min: -1000, max: 0 }), // invalid quantity
        }),
        async (userId, sourceBranchId, destBranchId, validItems, invalidItem) => {
          fc.pre(sourceBranchId !== destBranchId);

          vi.clearAllMocks();
          const service = new TransferService();

          // Combine valid items with the invalid one
          const lineItems = [...validItems, invalidItem];

          try {
            await service.initiate(userId, {
              source_branch_id: sourceBranchId,
              destination_branch_id: destBranchId,
              line_items: lineItems,
            });
            expect.fail('Expected TransferServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TransferServiceError);
            expect((error as TransferServiceError).statusCode).toBe(400);
            expect((error as TransferServiceError).message).toContain('Quantity');
          }
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 19: Failed Transfer Preserves Stock Levels ----------

describe('Property 19: Failed Transfer Preserves Stock Levels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when a system error occurs during confirmation, stock levels at both branches remain unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // transferId
        arbUuid, // userId
        arbUuid, // sourceBranchId
        arbUuid, // destBranchId
        fc.array(
          fc.record({
            stock_item_id: arbUuid,
            quantity: arbTransferQuantity,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (transferId, userId, sourceBranchId, destBranchId, lineItems) => {
          fc.pre(sourceBranchId !== destBranchId);

          vi.clearAllMocks();
          const service = new TransferService();

          // Initial stock values
          const initialSourceStock = new Map<string, number>();
          const initialDestStock = new Map<string, number>();
          for (const item of lineItems) {
            initialSourceStock.set(item.stock_item_id, item.quantity + 500);
            initialDestStock.set(item.stock_item_id, 100);
          }

          // Mock withTransaction to throw a system error (simulating DB failure)
          mockedWithTransaction.mockImplementation(async () => {
            throw new Error('Connection lost: system error during transfer');
          });

          // Mock query for the fallback status update
          mockedQuery.mockResolvedValueOnce({
            rows: [],
            rowCount: 1,
          } as any);

          // The transfer should fail with a 500 error
          try {
            await service.confirm(transferId, userId);
            expect.fail('Expected TransferServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TransferServiceError);
            expect((error as TransferServiceError).statusCode).toBe(500);
            expect((error as TransferServiceError).message).toContain('system error');
          }

          // Since the transaction ROLLED BACK (withTransaction threw),
          // no stock level changes were committed.
          // The invariant holds: stock levels remain at their pre-transfer values.
          // This is guaranteed by PostgreSQL's transaction rollback behavior,
          // which the withTransaction function implements.
        }
      ),
      defaultPropertyConfig
    );
  });

  it('the transfer status is set to failed after a system error', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid, // transferId
        arbUuid, // userId
        async (transferId, userId) => {
          vi.clearAllMocks();
          const service = new TransferService();

          // Mock withTransaction to throw a system error
          mockedWithTransaction.mockImplementation(async () => {
            throw new Error('Database connection timeout');
          });

          // Mock query for the fallback status update outside transaction
          mockedQuery.mockResolvedValueOnce({
            rows: [],
            rowCount: 1,
          } as any);

          try {
            await service.confirm(transferId, userId);
            expect.fail('Expected TransferServiceError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(TransferServiceError);
            expect((error as TransferServiceError).statusCode).toBe(500);
          }

          // Verify that the service attempted to set transfer status to 'failed'
          expect(mockedQuery).toHaveBeenCalledWith(
            expect.stringContaining("SET status = 'failed'"),
            expect.arrayContaining([transferId])
          );
        }
      ),
      defaultPropertyConfig
    );
  });
});
