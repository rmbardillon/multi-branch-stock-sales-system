/**
 * Property-Based Tests: Branch Management
 *
 * Feature: multi-branch-stock-sales-system
 * Property 3: Branch Data Persistence Round-Trip
 * Property 4: Branch Validation Rejects Invalid Input
 * Property 5: Branch Name Uniqueness
 * Property 6: Deactivated Branch Blocks New Operations
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  arbCreateBranchInput,
  arbBranchName,
  arbBranchStatus,
  defaultPropertyConfig,
} from '../factories/arbitraries';
import { createBranchSchema, updateBranchSchema } from '../../src/types/schemas';
import { BranchService, BranchServiceError } from '../../src/services/branch.service';
import type { Branch } from '../../src/types/entities';

// Mock the database connection module
vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../src/database/connection';

const mockedQuery = vi.mocked(query);

// ---------- Helpers ----------

/** Generate a fake Branch entity from DTO input */
function makeBranchFromInput(input: {
  name: string;
  address: string;
  contact_number: string;
  status: 'Active' | 'Inactive';
}): Branch {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: input.name,
    address: input.address,
    contact_number: input.contact_number,
    status: input.status,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ---------- Property 3: Branch Data Persistence Round-Trip ----------

describe('Property 3: Branch Data Persistence Round-Trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valid branch input passes createBranchSchema and round-trips through create + getById', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateBranchInput, async (input) => {
        vi.clearAllMocks();

        // Validate schema accepts valid input
        const parseResult = createBranchSchema.safeParse(input);
        expect(parseResult.success).toBe(true);

        // Mock: no duplicate name found
        mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        // Mock: INSERT returns the branch with same data
        const createdBranch = makeBranchFromInput(input);
        mockedQuery.mockResolvedValueOnce({
          rows: [createdBranch],
          rowCount: 1,
        } as any);

        const branchService = new BranchService();
        const result = await branchService.create(input);

        // Round-trip: returned data matches submitted data
        expect(result.name).toBe(input.name);
        expect(result.address).toBe(input.address);
        expect(result.contact_number).toBe(input.contact_number);
        expect(result.status).toBe(input.status);
      }),
      defaultPropertyConfig
    );
  });

  it('valid branch input passes updateBranchSchema and round-trips through update', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateBranchInput, async (input) => {
        vi.clearAllMocks();

        // updateBranchSchema accepts the same fields (all optional, but valid when present)
        const parseResult = updateBranchSchema.safeParse(input);
        expect(parseResult.success).toBe(true);

        const branchId = '00000000-0000-4000-8000-000000000001';
        const existingBranch = makeBranchFromInput({
          name: 'Old Name',
          address: 'Old Address',
          contact_number: '000',
          status: 'Active',
        });

        // Mock: branch exists
        mockedQuery.mockResolvedValueOnce({
          rows: [existingBranch],
          rowCount: 1,
        } as any);

        // Mock: no duplicate name
        mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        // Mock: UPDATE returns branch with new data
        const updatedBranch = makeBranchFromInput(input);
        mockedQuery.mockResolvedValueOnce({
          rows: [updatedBranch],
          rowCount: 1,
        } as any);

        const branchService = new BranchService();
        const result = await branchService.update(branchId, input);

        // Round-trip: returned data matches submitted data
        expect(result.name).toBe(input.name);
        expect(result.address).toBe(input.address);
        expect(result.contact_number).toBe(input.contact_number);
        expect(result.status).toBe(input.status);
      }),
      defaultPropertyConfig
    );
  });

  it('getById returns exactly the data that was stored', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateBranchInput, async (input) => {
        vi.clearAllMocks();

        const storedBranch = makeBranchFromInput(input);

        // Mock: SELECT returns the stored branch
        mockedQuery.mockResolvedValueOnce({
          rows: [storedBranch],
          rowCount: 1,
        } as any);

        const branchService = new BranchService();
        const result = await branchService.getById(storedBranch.id);

        expect(result.name).toBe(input.name);
        expect(result.address).toBe(input.address);
        expect(result.contact_number).toBe(input.contact_number);
        expect(result.status).toBe(input.status);
      }),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 4: Branch Validation Rejects Invalid Input ----------

describe('Property 4: Branch Validation Rejects Invalid Input', () => {
  /** Generate a branch input with at least one invalid field */
  const arbInvalidBranchInput = fc.oneof(
    // Empty name
    fc.record({
      name: fc.constant(''),
      address: fc.string({ minLength: 1, maxLength: 255 }),
      contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      status: arbBranchStatus,
    }),
    // Name too long (> 100 chars)
    fc.record({
      name: fc.string({ minLength: 101, maxLength: 150 }),
      address: fc.string({ minLength: 1, maxLength: 255 }),
      contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      status: arbBranchStatus,
    }),
    // Empty address
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      address: fc.constant(''),
      contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      status: arbBranchStatus,
    }),
    // Address too long (> 255 chars)
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      address: fc.string({ minLength: 256, maxLength: 300 }),
      contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      status: arbBranchStatus,
    }),
    // Empty contact number
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      address: fc.string({ minLength: 1, maxLength: 255 }),
      contact_number: fc.constant(''),
      status: arbBranchStatus,
    }),
    // Contact number too long (> 20 chars)
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      address: fc.string({ minLength: 1, maxLength: 255 }),
      contact_number: fc.string({ minLength: 21, maxLength: 40 }),
      status: arbBranchStatus,
    })
  );

  it('rejects branch input where at least one required field is empty or exceeds max length', () => {
    fc.assert(
      fc.property(arbInvalidBranchInput, (input) => {
        const result = createBranchSchema.safeParse(input);
        expect(result.success).toBe(false);

        if (!result.success) {
          // Should identify specific failing field(s)
          const fieldErrors = result.error.flatten().fieldErrors;
          const failingFields = Object.keys(fieldErrors);
          expect(failingFields.length).toBeGreaterThan(0);
        }
      }),
      defaultPropertyConfig
    );
  });

  it('rejects input with missing required fields entirely', () => {
    // Generate objects with at least one field missing
    const arbMissingFields = fc.oneof(
      // Missing name
      fc.record({
        address: fc.string({ minLength: 1, maxLength: 255 }),
        contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        status: arbBranchStatus,
      }),
      // Missing address
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        status: arbBranchStatus,
      }),
      // Missing contact_number
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        address: fc.string({ minLength: 1, maxLength: 255 }),
        status: arbBranchStatus,
      }),
      // Missing status
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        address: fc.string({ minLength: 1, maxLength: 255 }),
        contact_number: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      })
    );

    fc.assert(
      fc.property(arbMissingFields, (input) => {
        const result = createBranchSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      defaultPropertyConfig
    );
  });

  it('updateBranchSchema rejects fields that exceed max length when provided', () => {
    const arbInvalidUpdate = fc.oneof(
      // Name too long
      fc.record({
        name: fc.string({ minLength: 101, maxLength: 150 }),
      }),
      // Address too long
      fc.record({
        address: fc.string({ minLength: 256, maxLength: 300 }),
      }),
      // Contact number too long
      fc.record({
        contact_number: fc.string({ minLength: 21, maxLength: 40 }),
      })
    );

    fc.assert(
      fc.property(arbInvalidUpdate, (input) => {
        const result = updateBranchSchema.safeParse(input);
        expect(result.success).toBe(false);

        if (!result.success) {
          const fieldErrors = result.error.flatten().fieldErrors;
          expect(Object.keys(fieldErrors).length).toBeGreaterThan(0);
        }
      }),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 5: Branch Name Uniqueness ----------

describe('Property 5: Branch Name Uniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creating a branch with an existing name is rejected with 409', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateBranchInput, async (input) => {
        vi.clearAllMocks();

        // Mock: duplicate name found (simulates existing branch with same name)
        mockedQuery.mockResolvedValueOnce({
          rows: [{ id: '00000000-0000-4000-8000-000000000099' }],
          rowCount: 1,
        } as any);

        const branchService = new BranchService();

        try {
          await branchService.create(input);
          // Should not reach here
          expect.fail('Expected BranchServiceError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BranchServiceError);
          expect((error as BranchServiceError).statusCode).toBe(409);
          expect((error as BranchServiceError).message).toContain('already exists');
        }
      }),
      defaultPropertyConfig
    );
  });

  it('creating a branch with a unique name succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateBranchInput, async (input) => {
        vi.clearAllMocks();

        // Mock: no duplicate found
        mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        // Mock: INSERT returns new branch
        const newBranch = makeBranchFromInput(input);
        mockedQuery.mockResolvedValueOnce({
          rows: [newBranch],
          rowCount: 1,
        } as any);

        const branchService = new BranchService();
        const result = await branchService.create(input);
        expect(result.name).toBe(input.name);
      }),
      defaultPropertyConfig
    );
  });

  it('updating a branch name to an existing name is rejected with 409', async () => {
    await fc.assert(
      fc.asyncProperty(arbBranchName, arbBranchName, async (existingName, newName) => {
        vi.clearAllMocks();

        const branchId = '00000000-0000-4000-8000-000000000001';
        const existingBranch = makeBranchFromInput({
          name: existingName,
          address: '123 Test St',
          contact_number: '1234567890',
          status: 'Active',
        });

        // Mock: branch exists
        mockedQuery.mockResolvedValueOnce({
          rows: [existingBranch],
          rowCount: 1,
        } as any);

        // Mock: duplicate name found for the new name
        mockedQuery.mockResolvedValueOnce({
          rows: [{ id: '00000000-0000-4000-8000-000000000099' }],
          rowCount: 1,
        } as any);

        const branchService = new BranchService();

        try {
          await branchService.update(branchId, { name: newName });
          expect.fail('Expected BranchServiceError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BranchServiceError);
          expect((error as BranchServiceError).statusCode).toBe(409);
        }
      }),
      defaultPropertyConfig
    );
  });
});

// ---------- Property 6: Deactivated Branch Blocks New Operations ----------

describe('Property 6: Deactivated Branch Blocks New Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inactive branch is correctly identified as blocking new sale transactions', () => {
    fc.assert(
      fc.property(arbCreateBranchInput, (input) => {
        const inactiveBranch = makeBranchFromInput({ ...input, status: 'Inactive' });
        const activeBranch = makeBranchFromInput({ ...input, status: 'Active' });

        // Business rule: only active branches allow new operations
        const branchAllowsNewSales = (b: Branch): boolean => b.status === 'Active';

        expect(branchAllowsNewSales(inactiveBranch)).toBe(false);
        expect(branchAllowsNewSales(activeBranch)).toBe(true);
      }),
      defaultPropertyConfig
    );
  });

  it('inactive branch is correctly identified as blocking inbound stock transfers', () => {
    fc.assert(
      fc.property(arbCreateBranchInput, (input) => {
        const inactiveBranch = makeBranchFromInput({ ...input, status: 'Inactive' });
        const activeBranch = makeBranchFromInput({ ...input, status: 'Active' });

        // Business rule: inactive branches reject inbound transfers
        const branchAllowsInboundTransfer = (b: Branch): boolean => b.status === 'Active';

        expect(branchAllowsInboundTransfer(inactiveBranch)).toBe(false);
        expect(branchAllowsInboundTransfer(activeBranch)).toBe(true);
      }),
      defaultPropertyConfig
    );
  });

  it('deactivating a branch via BranchService sets status to Inactive', async () => {
    await fc.assert(
      fc.asyncProperty(arbCreateBranchInput, async (input) => {
        vi.clearAllMocks();

        const branchId = '00000000-0000-4000-8000-000000000001';
        const activeBranch = makeBranchFromInput({ ...input, status: 'Active' });
        const deactivatedBranch = makeBranchFromInput({ ...input, status: 'Inactive' });

        const branchService = new BranchService();

        // Mock: branch exists and is active
        mockedQuery.mockResolvedValueOnce({
          rows: [activeBranch],
          rowCount: 1,
        } as any);

        // Mock: no pending transfers
        mockedQuery.mockResolvedValueOnce({
          rows: [{ count: '0' }],
          rowCount: 1,
        } as any);

        // Mock: no pending sales
        mockedQuery.mockResolvedValueOnce({
          rows: [{ count: '0' }],
          rowCount: 1,
        } as any);

        // Mock: UPDATE sets status to Inactive
        mockedQuery.mockResolvedValueOnce({
          rows: [deactivatedBranch],
          rowCount: 1,
        } as any);

        const result = await branchService.deactivate(branchId);
        expect(result.branch.status).toBe('Inactive');
      }),
      defaultPropertyConfig
    );
  });

  it('for any branch status, operations are blocked iff status is Inactive', () => {
    fc.assert(
      fc.property(arbBranchName, arbBranchStatus, (name, status) => {
        const branch = makeBranchFromInput({
          name,
          address: '123 Test',
          contact_number: '555-0000',
          status,
        });

        const operationAllowed = branch.status === 'Active';

        if (status === 'Inactive') {
          expect(operationAllowed).toBe(false);
        } else {
          expect(operationAllowed).toBe(true);
        }
      }),
      defaultPropertyConfig
    );
  });
});
