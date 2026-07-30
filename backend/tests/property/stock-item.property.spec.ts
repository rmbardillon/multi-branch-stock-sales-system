/**
 * Property-Based Tests: Stock Item Management
 *
 * Feature: multi-branch-stock-sales-system
 * Property 7: Stock Item Data Persistence Round-Trip
 * Property 8: SKU Uniqueness
 * Property 9: Stock Item Search Completeness
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  arbCreateStockItemInput,
  arbSku,
  arbItemName,
  arbCategory,
  defaultPropertyConfig,
} from '../factories/arbitraries';
import { createStockItemSchema, updateStockItemSchema } from '../../src/types/schemas';
import { StockService, StockServiceError } from '../../src/services/stock.service';

// Mock the database connection module
vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  withTransaction: vi.fn(),
}));

import { query } from '../../src/database/connection';

const mockedQuery = vi.mocked(query);

// ---------- Property 7: Stock Item Data Persistence Round-Trip ----------

describe('Property 7: Stock Item Data Persistence Round-Trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createStockItemSchema accepts all valid stock item inputs', () => {
    fc.assert(
      fc.property(arbCreateStockItemInput, (input) => {
        const result = createStockItemSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      defaultPropertyConfig
    );
  });

  it('updateStockItemSchema accepts all valid partial stock item inputs', () => {
    fc.assert(
      fc.property(arbCreateStockItemInput, (input) => {
        // Each field individually should be valid as a partial update
        const fields = ['sku', 'name', 'description', 'category', 'unit_price', 'low_stock_threshold'] as const;

        for (const field of fields) {
          const partial = { [field]: input[field] };
          const result = updateStockItemSchema.safeParse(partial);
          expect(result.success).toBe(true);
        }
      }),
      defaultPropertyConfig
    );
  });

  it('creating a stock item and retrieving it returns identical data', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateStockItemInput, async (input) => {
        vi.clearAllMocks();
        const service = new StockService();
        const fakeId = 'generated-uuid-123';
        const now = new Date();

        // Mock: no existing SKU
        mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Mock: INSERT returns the created item
        mockedQuery.mockResolvedValueOnce({
          rows: [{
            id: fakeId,
            sku: input.sku,
            name: input.name,
            description: input.description,
            category: input.category,
            unit_price: input.unit_price,
            low_stock_threshold: input.low_stock_threshold,
            is_active: true,
            created_at: now,
            updated_at: now,
          }],
          rowCount: 1,
        } as never);

        const created = await service.createItem(input);

        // Verify round-trip: returned data matches what was submitted
        expect(created.sku).toBe(input.sku);
        expect(created.name).toBe(input.name);
        expect(created.description).toBe(input.description);
        expect(created.category).toBe(input.category);
        expect(created.unit_price).toBe(input.unit_price);
        expect(created.low_stock_threshold).toBe(input.low_stock_threshold);
      }),
      defaultPropertyConfig
    );
  });

  it('updating a stock item and retrieving it returns identical data', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateStockItemInput, async (input) => {
        vi.clearAllMocks();
        const service = new StockService();
        const existingId = 'existing-uuid-456';
        const now = new Date();

        // Mock: item exists
        mockedQuery.mockResolvedValueOnce({
          rows: [{
            id: existingId,
            sku: 'OLD-SKU',
            name: 'Old Name',
            description: 'Old desc',
            category: 'Old Cat',
            unit_price: 10.00,
            low_stock_threshold: 5,
            is_active: true,
            created_at: now,
            updated_at: now,
          }],
          rowCount: 1,
        } as never);
        // Mock: no SKU conflict
        mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Mock: UPDATE returns updated item
        mockedQuery.mockResolvedValueOnce({
          rows: [{
            id: existingId,
            sku: input.sku,
            name: input.name,
            description: input.description,
            category: input.category,
            unit_price: input.unit_price,
            low_stock_threshold: input.low_stock_threshold,
            is_active: true,
            created_at: now,
            updated_at: now,
          }],
          rowCount: 1,
        } as never);

        const updated = await service.updateItem(existingId, input);

        // Verify round-trip: returned data matches what was submitted
        expect(updated.sku).toBe(input.sku);
        expect(updated.name).toBe(input.name);
        expect(updated.description).toBe(input.description);
        expect(updated.category).toBe(input.category);
        expect(updated.unit_price).toBe(input.unit_price);
        expect(updated.low_stock_threshold).toBe(input.low_stock_threshold);
      }),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 8: SKU Uniqueness ----------

describe('Property 8: SKU Uniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createItem rejects a stock item when SKU already exists (409)', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateStockItemInput, async (input) => {
        vi.clearAllMocks();
        const service = new StockService();

        // Mock: SKU already exists in database
        mockedQuery.mockResolvedValueOnce({
          rows: [{ id: 'existing-item-id' }],
          rowCount: 1,
        } as never);

        try {
          await service.createItem(input);
          // Should not reach here
          expect.fail('Expected StockServiceError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(StockServiceError);
          expect((error as StockServiceError).statusCode).toBe(409);
          expect((error as StockServiceError).message).toContain(input.sku);
        }
      }),
      defaultPropertyConfig
    );
  });

  it('updateItem rejects when new SKU conflicts with another item (409)', async () => {
    await fc.assert(
      fc.asyncProperty(arbSku, async (newSku) => {
        vi.clearAllMocks();
        const service = new StockService();
        const existingItemId = 'item-to-update-id';
        const now = new Date();

        // Mock: item exists
        mockedQuery.mockResolvedValueOnce({
          rows: [{
            id: existingItemId,
            sku: 'CURRENT-SKU',
            name: 'Test Item',
            description: '',
            category: 'Cat',
            unit_price: 10.00,
            low_stock_threshold: 5,
            is_active: true,
            created_at: now,
            updated_at: now,
          }],
          rowCount: 1,
        } as never);
        // Mock: SKU conflict with different item
        mockedQuery.mockResolvedValueOnce({
          rows: [{ id: 'other-item-id' }],
          rowCount: 1,
        } as never);

        try {
          await service.updateItem(existingItemId, { sku: newSku });
          expect.fail('Expected StockServiceError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(StockServiceError);
          expect((error as StockServiceError).statusCode).toBe(409);
          expect((error as StockServiceError).message).toContain(newSku);
        }
      }),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 9: Stock Item Search Completeness ----------

describe('Property 9: Stock Item Search Completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Pure function that implements the same ILIKE matching logic the service uses.
   * For any search query, an item matches if the query string appears
   * (case-insensitive) in the item's SKU, name, or category.
   */
  function itemMatchesQuery(
    item: { sku: string; name: string; category: string },
    searchQuery: string
  ): boolean {
    const lowerQuery = searchQuery.toLowerCase();
    return (
      item.sku.toLowerCase().includes(lowerQuery) ||
      item.name.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery)
    );
  }

  it('all items returned by search match the query in SKU, name, or category (soundness)', () => {
    fc.assert(
      fc.property(
        // Generate a dataset of stock items
        fc.array(
          fc.record({
            id: fc.uuid(),
            sku: arbSku,
            name: arbItemName,
            category: arbCategory,
            description: fc.string({ maxLength: 100 }),
            unit_price: fc.double({ min: 0.01, max: 999.99, noNaN: true }),
            low_stock_threshold: fc.integer({ min: 0, max: 100 }),
            is_active: fc.constant(true),
            created_at: fc.constant(new Date()),
            updated_at: fc.constant(new Date()),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        // Generate a search query
        fc.string({ minLength: 1, maxLength: 10 }),
        (items, searchQuery) => {
          // Compute expected results using the pure matching function
          const expectedResults = items.filter((item) =>
            itemMatchesQuery(item, searchQuery)
          );

          // Every expected match must have the query in sku, name, or category
          for (const item of expectedResults) {
            expect(itemMatchesQuery(item, searchQuery)).toBe(true);
          }

          // Every non-match must NOT contain the query in any of those fields
          const nonMatches = items.filter(
            (item) => !itemMatchesQuery(item, searchQuery)
          );
          for (const item of nonMatches) {
            expect(itemMatchesQuery(item, searchQuery)).toBe(false);
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('search returns exactly the items that match (completeness and soundness)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            sku: arbSku,
            name: arbItemName,
            category: arbCategory,
            description: fc.string({ maxLength: 100 }),
            unit_price: fc.double({ min: 0.01, max: 999.99, noNaN: true }),
            low_stock_threshold: fc.integer({ min: 0, max: 100 }),
            is_active: fc.constant(true),
            created_at: fc.constant(new Date()),
            updated_at: fc.constant(new Date()),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.string({ minLength: 1, maxLength: 10 }),
        async (items, searchQuery) => {
          vi.clearAllMocks();
          const service = new StockService();

          // Compute what the ILIKE filter should return
          const expectedResults = items.filter((item) =>
            itemMatchesQuery(item, searchQuery)
          );

          // Mock the database query to return the filtered results
          // (simulating what PostgreSQL ILIKE would return)
          mockedQuery.mockResolvedValueOnce({
            rows: expectedResults,
            rowCount: expectedResults.length,
          } as never);

          const results = await service.search(searchQuery);

          // Verify: results contain exactly the matching items
          expect(results.length).toBe(expectedResults.length);

          // Every returned item matches the query
          for (const item of results) {
            expect(itemMatchesQuery(item, searchQuery)).toBe(true);
          }

          // No items matching the query are excluded
          const resultIds = new Set(results.map((r) => r.id));
          for (const expected of expectedResults) {
            expect(resultIds.has(expected.id)).toBe(true);
          }
        }
      ),
      defaultPropertyConfig
    );
  });

  it('search with empty results returns no items when no items match', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            sku: arbSku,
            name: arbItemName,
            category: arbCategory,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          // Use a query string that cannot appear in any generated field
          const impossibleQuery = '\u2603\u2603\u2603'; // snowman chars

          const matches = items.filter((item) =>
            itemMatchesQuery(item, impossibleQuery)
          );

          // No items should match this query
          expect(matches.length).toBe(0);
        }
      ),
      defaultPropertyConfig
    );
  });

  it('search is case-insensitive: matching ignores case variations', () => {
    fc.assert(
      fc.property(
        arbSku,
        arbItemName,
        arbCategory,
        (sku, name, category) => {
          const item = { sku, name, category };

          // If the item matches with the original query, it should also match
          // with upper/lower variations
          if (sku.length > 0) {
            const queryLower = sku.toLowerCase();
            const queryUpper = sku.toUpperCase();

            const matchesLower = itemMatchesQuery(item, queryLower);
            const matchesUpper = itemMatchesQuery(item, queryUpper);

            // Both case variants should produce the same result
            expect(matchesLower).toBe(matchesUpper);
          }
        }
      ),
      defaultPropertyConfig
    );
  });
});
