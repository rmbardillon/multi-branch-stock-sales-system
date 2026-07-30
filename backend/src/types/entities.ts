// Entity types for the Multi-Branch Stock Sales System

export type Role = 'Admin' | 'Branch_Manager' | 'Sales_Staff';
export type BranchStatus = 'Active' | 'Inactive';
export type TransferStatus = 'pending' | 'confirmed' | 'failed';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  assigned_branch_id: string | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_activity: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  contact_number: string;
  status: BranchStatus;
  created_at: Date;
  updated_at: Date;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StockLevel {
  id: string;
  branch_id: string;
  stock_item_id: string;
  quantity: number;
  last_updated: Date;
}

export interface SaleTransaction {
  id: string;
  reference_number: string;
  branch_id: string;
  created_by: string;
  total_amount: number;
  transaction_date: Date;
  created_at: Date;
}

export interface SaleLineItem {
  id: string;
  sale_transaction_id: string;
  stock_item_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface StockTransfer {
  id: string;
  source_branch_id: string;
  destination_branch_id: string;
  initiated_by: string;
  status: TransferStatus;
  created_at: Date;
  confirmed_at: Date | null;
}

export interface TransferLineItem {
  id: string;
  stock_transfer_id: string;
  stock_item_id: string;
  quantity: number;
}

export interface AuditRecord {
  id: string;
  user_id: string;
  branch_id: string;
  action_type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}
