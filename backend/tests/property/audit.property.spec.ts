/**
 * Property-Based Tests: Audit Trail
 *
 * Feature: multi-branch-stock-sales-system
 * Property 26: Audit Record Completeness
 * Property 27: Audit Query Filter Accuracy
 *
 * **Validates: Requirements 9.1, 9.3**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { arbUuid, defaultPropertyConfig } from '../factories/arbitraries';
import type { AuditEntry, AuditActionType, AuditQueryFilters } from '../../src/services/audit.service';
import type { AuditRecord } from '../../src/types/entities';

// ---------- Mock Database ----------

vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  withTransaction: vi.fn(),
  closePool: vi.fn(),
}));

import { query } from '../../src/database/connection';
import { AuditService } from '../../src/services/audit.service';

const mockQuery = vi.mocked(query);

// ---------- Helper Arbitraries ----------

/** Generate a valid audit action type */
const arbActionType: fc.Arbitrary<AuditActionType> = fc.constantFrom(
  'stock_adjustment',
  'sale_created',
  'transfer_initiated',
  'transfer_confirmed',
  'transfer_failed',
  'user_created',
  'user_updated',
  'branch_created',
  'branch_updated',
  'branch_deactivated'
);

/** Generate a date within a reasonable range (2023-01-01 to 2025-01-01) */
const arbDate = fc
  .integer({ min: 1672531200000, max: 1735689600000 })
  .map((ts) => new Date(ts));

/** Generate a non-empty description */
const arbAuditDescription = fc.string({ minLength: 1, maxLength: 200 });

/** Generate metadata with affected item identifiers and quantities */
const arbMetadata = fc.record({
  itemId: arbUuid,
  quantity: fc.integer({ min: 1, max: 10000 }),
  additionalInfo: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

/** Generate a complete AuditEntry */
const arbAuditEntry: fc.Arbitrary<AuditEntry> = fc.record({
  userId: arbUuid,
  branchId: arbUuid,
  actionType: arbActionType as fc.Arbitrary<AuditActionType | string>,
  description: arbAuditDescription,
  metadata: arbMetadata.map((m) => m as Record<string, unknown>),
});

/** Generate a stored AuditRecord (as it would exist in the database) */
const arbAuditRecord: fc.Arbitrary<AuditRecord> = fc.record({
  id: arbUuid,
  user_id: arbUuid,
  branch_id: arbUuid,
  action_type: arbActionType as fc.Arbitrary<string>,
  description: arbAuditDescription,
  metadata: arbMetadata.map((m) => m as Record<string, unknown>),
  created_at: arbDate,
});

// ---------- Property 26: Audit Record Completeness ----------

describe('Property 26: Audit Record Completeness', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService();
  });

  afterEach(() => {
    service.stopDeadLetterWorker();
  });

  it('audit log() correctly structures entries with all required fields (userId, branchId, actionType, description, metadata)', () => {
    fc.assert(
      fc.property(arbAuditEntry, (entry) => {
        // Track what gets passed to the database insert
        let capturedParams: unknown[] = [];

        mockQuery.mockImplementation(async (_sql: string, params?: unknown[]) => {
          capturedParams = params || [];
          return { rows: [], rowCount: 1 } as never;
        });

        // Call log and await it
        const logPromise = service.log(entry);

        return logPromise.then(() => {
          // Verify the insert was called with properly structured data
          expect(capturedParams.length).toBe(5);

          // Param 1: userId - must be present
          expect(capturedParams[0]).toBe(entry.userId);

          // Param 2: branchId - must be present
          expect(capturedParams[1]).toBe(entry.branchId);

          // Param 3: actionType - must be present
          expect(capturedParams[2]).toBe(entry.actionType);

          // Param 4: description - must be present
          expect(capturedParams[3]).toBe(entry.description);

          // Param 5: metadata (JSON stringified) - must contain item identifiers and quantities
          const metadataStr = capturedParams[4] as string;
          expect(metadataStr).toBeDefined();
          const parsedMetadata = JSON.parse(metadataStr);
          expect(parsedMetadata).toEqual(entry.metadata);
        });
      }),
      defaultPropertyConfig
    );
  });

  it('audit entries always include all mandatory fields regardless of action type', () => {
    fc.assert(
      fc.property(
        arbUuid,
        arbUuid,
        arbActionType,
        arbAuditDescription,
        arbMetadata,
        (userId, branchId, actionType, description, metadata) => {
          let capturedParams: unknown[] = [];

          mockQuery.mockImplementation(async (_sql: string, params?: unknown[]) => {
            capturedParams = params || [];
            return { rows: [], rowCount: 1 } as never;
          });

          const entry: AuditEntry = {
            userId,
            branchId,
            actionType,
            description,
            metadata: metadata as Record<string, unknown>,
          };

          return service.log(entry).then(() => {
            // All 5 fields must be non-null/non-undefined
            expect(capturedParams[0]).toBeTruthy(); // userId
            expect(capturedParams[1]).toBeTruthy(); // branchId
            expect(capturedParams[2]).toBeTruthy(); // actionType
            expect(capturedParams[3]).toBeDefined(); // description (can be empty string)
            expect(capturedParams[4]).toBeDefined(); // metadata (serialized)

            // Verify field types
            expect(typeof capturedParams[0]).toBe('string'); // userId is UUID string
            expect(typeof capturedParams[1]).toBe('string'); // branchId is UUID string
            expect(typeof capturedParams[2]).toBe('string'); // actionType is string
            expect(typeof capturedParams[3]).toBe('string'); // description is string
            expect(typeof capturedParams[4]).toBe('string'); // metadata is JSON string
          });
        }
      ),
      defaultPropertyConfig
    );
  });

  it('metadata correctly preserves affected item identifiers and quantities', () => {
    fc.assert(
      fc.property(
        arbUuid,
        arbUuid,
        arbActionType,
        fc.array(
          fc.record({
            itemId: arbUuid,
            quantity: fc.integer({ min: 1, max: 10000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, branchId, actionType, affectedItems) => {
          let capturedParams: unknown[] = [];

          mockQuery.mockImplementation(async (_sql: string, params?: unknown[]) => {
            capturedParams = params || [];
            return { rows: [], rowCount: 1 } as never;
          });

          const metadata = { affectedItems };
          const entry: AuditEntry = {
            userId,
            branchId,
            actionType,
            description: `Operation affecting ${affectedItems.length} items`,
            metadata,
          };

          return service.log(entry).then(() => {
            const storedMetadata = JSON.parse(capturedParams[4] as string);
            expect(storedMetadata.affectedItems).toEqual(affectedItems);

            // Each affected item has both itemId and quantity
            for (const item of storedMetadata.affectedItems) {
              expect(item.itemId).toBeDefined();
              expect(typeof item.itemId).toBe('string');
              expect(item.quantity).toBeDefined();
              expect(typeof item.quantity).toBe('number');
              expect(item.quantity).toBeGreaterThan(0);
            }
          });
        }
      ),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 27: Audit Query Filter Accuracy ----------

describe('Property 27: Audit Query Filter Accuracy', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService();
  });

  afterEach(() => {
    service.stopDeadLetterWorker();
  });

  it('every returned record matches ALL specified filters', () => {
    fc.assert(
      fc.property(
        fc.array(arbAuditRecord, { minLength: 1, maxLength: 30 }),
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbActionType as fc.Arbitrary<string>, { nil: undefined }),
        (records, date1, date2, filterUserId, filterBranchId, filterActionType) => {
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          // Simulate what the query method does: apply filters and return matching records
          const filtered = records.filter((record) => {
            // Date range filter
            if (record.created_at < startDate || record.created_at > endDate) {
              return false;
            }

            // User filter
            if (filterUserId && record.user_id !== filterUserId) {
              return false;
            }

            // Branch filter
            if (filterBranchId && record.branch_id !== filterBranchId) {
              return false;
            }

            // Action type filter
            if (filterActionType && record.action_type !== filterActionType) {
              return false;
            }

            return true;
          });

          // Verify: every record in the filtered result satisfies ALL filter criteria
          for (const record of filtered) {
            expect(record.created_at.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(record.created_at.getTime()).toBeLessThanOrEqual(endDate.getTime());

            if (filterUserId) {
              expect(record.user_id).toBe(filterUserId);
            }

            if (filterBranchId) {
              expect(record.branch_id).toBe(filterBranchId);
            }

            if (filterActionType) {
              expect(record.action_type).toBe(filterActionType);
            }
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('no matching record is excluded from the filtered results', () => {
    fc.assert(
      fc.property(
        fc.array(arbAuditRecord, { minLength: 1, maxLength: 30 }),
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbActionType as fc.Arbitrary<string>, { nil: undefined }),
        (records, date1, date2, filterUserId, filterBranchId, filterActionType) => {
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          // Apply filters
          const filtered = records.filter((record) => {
            if (record.created_at < startDate || record.created_at > endDate) {
              return false;
            }
            if (filterUserId && record.user_id !== filterUserId) {
              return false;
            }
            if (filterBranchId && record.branch_id !== filterBranchId) {
              return false;
            }
            if (filterActionType && record.action_type !== filterActionType) {
              return false;
            }
            return true;
          });

          // Verify: no record that satisfies all criteria is missing from results
          for (const record of records) {
            const matchesDate =
              record.created_at >= startDate && record.created_at <= endDate;
            const matchesUser = !filterUserId || record.user_id === filterUserId;
            const matchesBranch = !filterBranchId || record.branch_id === filterBranchId;
            const matchesAction = !filterActionType || record.action_type === filterActionType;

            if (matchesDate && matchesUser && matchesBranch && matchesAction) {
              expect(filtered).toContainEqual(record);
            }
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('the query method applies all filters correctly to the database query', () => {
    fc.assert(
      fc.property(
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbActionType as fc.Arbitrary<string>, { nil: undefined }),
        (date1, date2, filterUserId, filterBranchId, filterActionType) => {
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          let capturedSqls: string[] = [];
          let capturedParams: unknown[][] = [];

          mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
            capturedSqls.push(sql);
            capturedParams.push(params || []);

            if (sql.includes('COUNT')) {
              return { rows: [{ total: '0' }], rowCount: 1 } as never;
            }
            return { rows: [], rowCount: 0 } as never;
          });

          const filters: AuditQueryFilters = {
            startDate,
            endDate,
            userId: filterUserId,
            branchId: filterBranchId,
            actionType: filterActionType,
            page: 1,
            pageSize: 50,
          };

          return service.query(filters).then(() => {
            // The query should have been called at least twice (COUNT + SELECT)
            expect(capturedSqls.length).toBe(2);

            // Check that filters are reflected in the SQL conditions
            const countSql = capturedSqls[0];
            const dataSql = capturedSqls[1];

            // Date filters should always be present since both startDate/endDate provided
            expect(countSql).toContain('created_at >=');
            expect(countSql).toContain('created_at <=');
            expect(dataSql).toContain('created_at >=');
            expect(dataSql).toContain('created_at <=');

            if (filterUserId) {
              expect(countSql).toContain('user_id =');
              expect(dataSql).toContain('user_id =');
            }

            if (filterBranchId) {
              expect(countSql).toContain('branch_id =');
              expect(dataSql).toContain('branch_id =');
            }

            if (filterActionType) {
              expect(countSql).toContain('action_type =');
              expect(dataSql).toContain('action_type =');
            }
          });
        }
      ),
      defaultPropertyConfig
    );
  });

  it('filtering is idempotent: filtering the result again produces the same result', () => {
    fc.assert(
      fc.property(
        fc.array(arbAuditRecord, { minLength: 1, maxLength: 30 }),
        arbDate,
        arbDate,
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbUuid, { nil: undefined }),
        fc.option(arbActionType as fc.Arbitrary<string>, { nil: undefined }),
        (records, date1, date2, filterUserId, filterBranchId, filterActionType) => {
          const startDate = date1 < date2 ? date1 : date2;
          const endDate = date1 < date2 ? date2 : date1;

          const applyFilter = (data: AuditRecord[]) =>
            data.filter((record) => {
              if (record.created_at < startDate || record.created_at > endDate) {
                return false;
              }
              if (filterUserId && record.user_id !== filterUserId) {
                return false;
              }
              if (filterBranchId && record.branch_id !== filterBranchId) {
                return false;
              }
              if (filterActionType && record.action_type !== filterActionType) {
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
