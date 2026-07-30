import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  arbValidPassword,
  arbCreateBranchInput,
  arbCreateStockItemInput,
  arbCreateSaleInput,
  arbCreateTransferInput,
  defaultPropertyConfig,
} from '../factories/arbitraries';
import {
  createBranchSchema,
  createStockItemSchema,
  createSaleSchema,
  createTransferSchema,
  passwordSchema,
} from '../../src/types/schemas';

describe('fast-check Arbitraries Validation', () => {
  it('arbValidPassword generates passwords passing schema validation', () => {
    fc.assert(
      fc.property(arbValidPassword, (password) => {
        const result = passwordSchema.safeParse(password);
        return result.success;
      }),
      defaultPropertyConfig
    );
  });

  it('arbCreateBranchInput generates valid branch data', () => {
    fc.assert(
      fc.property(arbCreateBranchInput, (input) => {
        const result = createBranchSchema.safeParse(input);
        return result.success;
      }),
      defaultPropertyConfig
    );
  });

  it('arbCreateStockItemInput generates valid stock item data', () => {
    fc.assert(
      fc.property(arbCreateStockItemInput, (input) => {
        const result = createStockItemSchema.safeParse(input);
        return result.success;
      }),
      defaultPropertyConfig
    );
  });

  it('arbCreateSaleInput generates valid sale data', () => {
    fc.assert(
      fc.property(arbCreateSaleInput, (input) => {
        const result = createSaleSchema.safeParse(input);
        return result.success;
      }),
      defaultPropertyConfig
    );
  });

  it('arbCreateTransferInput generates valid transfer data', () => {
    fc.assert(
      fc.property(arbCreateTransferInput, (input) => {
        const result = createTransferSchema.safeParse(input);
        return result.success;
      }),
      defaultPropertyConfig
    );
  });
});
