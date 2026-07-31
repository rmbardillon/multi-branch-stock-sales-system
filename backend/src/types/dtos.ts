// DTOs (Data Transfer Objects) for create/update operations

import type { BranchStatus, Role } from './entities';

export interface LoginDto {
  username: string;
  password: string;
}

export interface CreateBranchDto {
  name: string;
  address: string;
  contact_number: string;
  status: BranchStatus;
}

export interface UpdateBranchDto {
  name?: string;
  address?: string;
  contact_number?: string;
  status?: BranchStatus;
}

export interface CreateStockItemDto {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit_price: number;
  low_stock_threshold: number;
}

export interface UpdateStockItemDto {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit_price?: number;
  low_stock_threshold?: number;
}

export interface CreateSaleLineItemDto {
  stock_item_id: string;
  quantity: number;
  unit_price: number;
}

export interface CreateSaleDto {
  branch_id: string;
  line_items: CreateSaleLineItemDto[];
}

export interface CreateTransferLineItemDto {
  stock_item_id: string;
  quantity: number;
}

export interface CreateTransferDto {
  source_branch_id: string;
  destination_branch_id: string;
  line_items: CreateTransferLineItemDto[];
}

export interface CreateUserDto {
  username: string;
  password: string;
  role: Role;
  assigned_branch_id?: string | null;
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  role?: Role;
  assigned_branch_id?: string | null;
  is_active?: boolean;
}

export interface AdjustStockDto {
  stock_item_id: string;
  adjustment: number;
  reason: string;
}
