import { z } from 'zod';

// Login form schema - mirrors backend loginSchema
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// Branch form schema
export const branchSchema = z.object({
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
  status: z.enum(['Active', 'Inactive'], {
    required_error: 'Status is required',
  }),
});

export type BranchFormValues = z.infer<typeof branchSchema>;

// User form schema
export const userSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(50, 'Username must be at most 50 characters'),
  password: z
    .string()
    .optional(),
  role: z.enum(['Admin', 'Branch_Manager', 'Sales_Staff'], {
    required_error: 'Role is required',
  }),
  assigned_branch_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.role === 'Branch_Manager' || data.role === 'Sales_Staff') {
      return data.assigned_branch_id != null && data.assigned_branch_id !== '';
    }
    return true;
  },
  {
    message: 'A branch must be assigned for Branch Manager or Sales Staff roles',
    path: ['assigned_branch_id'],
  }
);

export const createUserSchema = userSchema.refine(
  (data) => {
    return data.password != null && data.password.length >= 8;
  },
  {
    message: 'Password is required and must be at least 8 characters',
    path: ['password'],
  }
);

export type UserFormValues = z.infer<typeof userSchema>;
