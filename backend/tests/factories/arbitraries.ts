/**
 * fast-check arbitraries (generators) for domain objects.
 * Used in property-based tests to generate random valid/invalid inputs.
 */

import * as fc from 'fast-check';
import type { Role, BranchStatus, TransferStatus } from '../../src/types/entities';

// ---------- Primitive Arbitraries ----------

/** Generate a valid UUID v4 string */
export const arbUuid = fc.uuid();

/** Generate a valid role */
export const arbRole: fc.Arbitrary<Role> = fc.constantFrom('Admin', 'Branch_Manager', 'Sales_Staff');

/** Generate a valid branch status */
export const arbBranchStatus: fc.Arbitrary<BranchStatus> = fc.constantFrom('Active', 'Inactive');

/** Generate a valid transfer status */
export const arbTransferStatus: fc.Arbitrary<TransferStatus> = fc.constantFrom('pending', 'confirmed', 'failed');

// ---------- String Arbitraries with Length Constraints ----------

/** Generate a non-empty string up to maxLength */
function arbNonEmptyString(maxLength: number): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength });
}

/** Generate a valid branch name (1-100 chars) */
export const arbBranchName = arbNonEmptyString(100);

/** Generate a valid branch address (1-255 chars) */
export const arbBranchAddress = arbNonEmptyString(255);

/** Generate a valid contact number (1-20 chars, digits and formatting) */
export const arbContactNumber = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

/** Generate a valid SKU (1-30 chars) */
export const arbSku = arbNonEmptyString(30);

/** Generate a valid item name (1-100 chars) */
export const arbItemName = arbNonEmptyString(100);

/** Generate a valid description (0-500 chars) */
export const arbDescription = fc.string({ minLength: 0, maxLength: 500 });

/** Generate a valid category (non-empty) */
export const arbCategory = arbNonEmptyString(50);

// ---------- Numeric Arbitraries ----------

/** Generate a valid unit price (0.01 to 999999999.99) */
export const arbUnitPrice = fc.double({ min: 0.01, max: 999999999.99, noNaN: true }).map(
  (n) => parseFloat(n.toFixed(2))
);

/** Generate a valid low stock threshold (>= 0, integer) */
export const arbLowStockThreshold = fc.integer({ min: 0, max: 10000 });

/** Generate a valid stock quantity (>= 0, integer) */
export const arbStockQuantity = fc.integer({ min: 0, max: 100000 });

/** Generate a valid sale quantity (>= 1, integer) */
export const arbSaleQuantity = fc.integer({ min: 1, max: 10000 });

/** Generate a valid transfer quantity (1-10000, integer) */
export const arbTransferQuantity = fc.integer({ min: 1, max: 10000 });

// ---------- Password Arbitraries ----------

/** Generate a valid password (8-128 chars, with uppercase, lowercase, digit) */
export const arbValidPassword = fc
  .tuple(
    fc.string({ minLength: 5, maxLength: 125 }),
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Z'),
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'z'),
    fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
  )
  .map(([base, upper, lower, digit]) => `${upper}${lower}${digit}${base}`)
  .filter((s) => s.length >= 8 && s.length <= 128);

/** Generate an invalid password (missing requirements) */
export const arbInvalidPassword = fc.oneof(
  // Too short
  fc.string({ minLength: 0, maxLength: 7 }),
  // Too long
  fc.string({ minLength: 129, maxLength: 200 }),
  // No uppercase
  fc.string({ minLength: 8, maxLength: 128 }).filter(
    (s) => !/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)
  ),
  // No lowercase
  fc.string({ minLength: 8, maxLength: 128 }).filter(
    (s) => /[A-Z]/.test(s) && !/[a-z]/.test(s) && /[0-9]/.test(s)
  ),
  // No digit
  fc.string({ minLength: 8, maxLength: 128 }).filter(
    (s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && !/[0-9]/.test(s)
  )
);

// ---------- Composite Object Arbitraries ----------

/** Generate valid branch creation input */
export const arbCreateBranchInput = fc.record({
  name: arbBranchName,
  address: arbBranchAddress,
  contact_number: arbContactNumber,
  status: arbBranchStatus,
});

/** Generate valid stock item creation input */
export const arbCreateStockItemInput = fc.record({
  sku: arbSku,
  name: arbItemName,
  description: arbDescription,
  category: arbCategory,
  unit_price: arbUnitPrice,
  low_stock_threshold: arbLowStockThreshold,
});

/** Generate a valid sale line item input */
export const arbSaleLineItemInput = fc.record({
  stock_item_id: arbUuid,
  quantity: arbSaleQuantity,
  unit_price: arbUnitPrice,
});

/** Generate valid sale creation input (1-10 line items) */
export const arbCreateSaleInput = fc.record({
  branch_id: arbUuid,
  line_items: fc.array(arbSaleLineItemInput, { minLength: 1, maxLength: 10 }),
});

/** Generate a valid transfer line item input */
export const arbTransferLineItemInput = fc.record({
  stock_item_id: arbUuid,
  quantity: arbTransferQuantity,
});

/** Generate valid transfer creation input (1-50 line items, different branches) */
export const arbCreateTransferInput = fc
  .tuple(arbUuid, arbUuid, fc.array(arbTransferLineItemInput, { minLength: 1, maxLength: 50 }))
  .filter(([src, dst]) => src !== dst)
  .map(([source_branch_id, destination_branch_id, line_items]) => ({
    source_branch_id,
    destination_branch_id,
    line_items,
  }));

// ---------- fast-check Configuration ----------

/** Default property test parameters: minimum 100 iterations */
export const defaultPropertyConfig: fc.Parameters<unknown> = {
  numRuns: 100,
};
