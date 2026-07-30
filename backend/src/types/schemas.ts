// Zod validation schemas for all inputs

import { z } from 'zod';

// Password must be 8-128 chars with at least 1 uppercase, 1 lowercase, 1 digit
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one numeric digit');

// --- Auth ---

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// --- Branch ---

export const createBranchSchema = z.object({
  name: z
    .string()
    .min(1, 'Branch name is required')
    .max(100, 'Branch name must be at most 100 characters'),
  address: z
    .string()
    .min(1, 'Address is required')
    .max(255, 'Address must be at most 255 characters'),
  contact_number: z
    .string()
    .min(1, 'Contact number is required')
    .max(20, 'Contact number must be at most 20 characters'),
  status: z.enum(['Active', 'Inactive']),
});

export const updateBranchSchema = z.object({
  name: z
    .string()
    .min(1, 'Branch name is required')
    .max(100, 'Branch name must be at most 100 characters')
    .optional(),
  address: z
    .string()
    .min(1, 'Address is required')
    .max(255, 'Address must be at most 255 characters')
    .optional(),
  contact_number: z
    .string()
    .min(1, 'Contact number is required')
    .max(20, 'Contact number must be at most 20 characters')
    .optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});

// --- Stock Item ---

export const createStockItemSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(30, 'SKU must be at most 30 characters'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .default(''),
  category: z.string().min(1, 'Category is required'),
  unit_price: z
    .number()
    .min(0.01, 'Unit price must be at least 0.01')
    .max(999999999.99, 'Unit price must be at most 999,999,999.99'),
  low_stock_threshold: z
    .number()
    .int('Low stock threshold must be an integer')
    .min(0, 'Low stock threshold must be at least 0'),
});

export const updateStockItemSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(30, 'SKU must be at most 30 characters')
    .optional(),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  category: z.string().min(1, 'Category is required').optional(),
  unit_price: z
    .number()
    .min(0.01, 'Unit price must be at least 0.01')
    .max(999999999.99, 'Unit price must be at most 999,999,999.99')
    .optional(),
  low_stock_threshold: z
    .number()
    .int('Low stock threshold must be an integer')
    .min(0, 'Low stock threshold must be at least 0')
    .optional(),
});

// --- Sales ---

const saleLineItemSchema = z.object({
  stock_item_id: z.string().uuid('Stock item ID must be a valid UUID'),
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
  unit_price: z
    .number()
    .min(0.01, 'Unit price must be at least 0.01')
    .max(999999999.99, 'Unit price must be at most 999,999,999.99'),
});

export const createSaleSchema = z.object({
  branch_id: z.string().uuid('Branch ID must be a valid UUID'),
  line_items: z
    .array(saleLineItemSchema)
    .min(1, 'At least one line item is required'),
});

// --- Stock Transfer ---

const transferLineItemSchema = z.object({
  stock_item_id: z.string().uuid('Stock item ID must be a valid UUID'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(10000, 'Quantity must be at most 10,000'),
});

export const createTransferSchema = z
  .object({
    source_branch_id: z.string().uuid('Source branch ID must be a valid UUID'),
    destination_branch_id: z.string().uuid('Destination branch ID must be a valid UUID'),
    line_items: z
      .array(transferLineItemSchema)
      .min(1, 'At least one line item is required')
      .max(50, 'Maximum 50 line items per transfer'),
  })
  .refine((data) => data.source_branch_id !== data.destination_branch_id, {
    message: 'Source and destination branches must be different',
    path: ['destination_branch_id'],
  });

// --- User ---

export const createUserSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(50, 'Username must be at most 50 characters'),
  password: passwordSchema,
  role: z.enum(['Admin', 'Branch_Manager', 'Sales_Staff']),
  assigned_branch_id: z.string().uuid('Branch ID must be a valid UUID').nullable().optional(),
}).refine(
  (data) => {
    if (data.role === 'Branch_Manager' || data.role === 'Sales_Staff') {
      return data.assigned_branch_id != null;
    }
    return true;
  },
  {
    message: 'A branch must be assigned when role is Branch_Manager or Sales_Staff',
    path: ['assigned_branch_id'],
  }
);

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(50, 'Username must be at most 50 characters')
    .optional(),
  password: passwordSchema.optional(),
  role: z.enum(['Admin', 'Branch_Manager', 'Sales_Staff']).optional(),
  assigned_branch_id: z.string().uuid('Branch ID must be a valid UUID').nullable().optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => {
    // If role is being set to a branch-scoped role, assigned_branch_id must be provided (not null)
    if (data.role === 'Branch_Manager' || data.role === 'Sales_Staff') {
      // If branch is explicitly set to null, reject
      if (data.assigned_branch_id === null) {
        return false;
      }
    }
    return true;
  },
  {
    message: 'A branch must be assigned when role is Branch_Manager or Sales_Staff',
    path: ['assigned_branch_id'],
  }
);

// --- Inferred Types from Schemas ---

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;
export type UpdateStockItemInput = z.infer<typeof updateStockItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Re-export password schema for use in property tests
export { passwordSchema };
