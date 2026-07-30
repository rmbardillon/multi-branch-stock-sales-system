/**
 * Test factories for generating valid entity test data.
 * Each factory produces data that conforms to the entity types and Zod schemas.
 */

import { v4 as uuid } from 'uuid';
import type {
  Branch,
  User,
  StockItem,
  StockLevel,
  SaleTransaction,
  SaleLineItem,
  StockTransfer,
  TransferLineItem,
  AuditRecord,
  Role,
  BranchStatus,
  TransferStatus,
} from '../../src/types/entities';

// ---------- Utility ----------

let counter = 0;
function nextId(): string {
  return uuid();
}

function uniqueStr(prefix: string): string {
  counter++;
  return `${prefix}_${counter}_${Date.now()}`;
}

// ---------- Branch Factory ----------

export interface CreateTestBranchOptions {
  id?: string;
  name?: string;
  address?: string;
  contact_number?: string;
  status?: BranchStatus;
  created_at?: Date;
  updated_at?: Date;
}

export function createTestBranch(options: CreateTestBranchOptions = {}): Branch {
  const now = new Date();
  return {
    id: options.id ?? nextId(),
    name: options.name ?? uniqueStr('Branch'),
    address: options.address ?? `${Math.floor(Math.random() * 999) + 1} Test Street, City`,
    contact_number: options.contact_number ?? `+1${String(Math.floor(Math.random() * 9000000000) + 1000000000)}`,
    status: options.status ?? 'Active',
    created_at: options.created_at ?? now,
    updated_at: options.updated_at ?? now,
  };
}

// ---------- User Factory ----------

export interface CreateTestUserOptions {
  id?: string;
  username?: string;
  password_hash?: string;
  role?: Role;
  assigned_branch_id?: string | null;
  failed_login_attempts?: number;
  locked_until?: Date | null;
  last_activity?: Date | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export function createTestUser(options: CreateTestUserOptions = {}): User {
  const now = new Date();
  return {
    id: options.id ?? nextId(),
    username: options.username ?? uniqueStr('user'),
    password_hash: options.password_hash ?? '$2b$10$fakehashfortest.000000000000000000000000000000000',
    role: options.role ?? 'Sales_Staff',
    assigned_branch_id: options.assigned_branch_id ?? nextId(),
    failed_login_attempts: options.failed_login_attempts ?? 0,
    locked_until: options.locked_until ?? null,
    last_activity: options.last_activity ?? now,
    is_active: options.is_active ?? true,
    created_at: options.created_at ?? now,
    updated_at: options.updated_at ?? now,
  };
}

// ---------- Stock Item Factory ----------

export interface CreateTestStockItemOptions {
  id?: string;
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit_price?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export function createTestStockItem(options: CreateTestStockItemOptions = {}): StockItem {
  const now = new Date();
  return {
    id: options.id ?? nextId(),
    sku: options.sku ?? uniqueStr('SKU'),
    name: options.name ?? uniqueStr('Item'),
    description: options.description ?? 'A test stock item description',
    category: options.category ?? 'Electronics',
    unit_price: options.unit_price ?? parseFloat((Math.random() * 999 + 1).toFixed(2)),
    low_stock_threshold: options.low_stock_threshold ?? 10,
    is_active: options.is_active ?? true,
    created_at: options.created_at ?? now,
    updated_at: options.updated_at ?? now,
  };
}

// ---------- Stock Level Factory ----------

export interface CreateTestStockLevelOptions {
  id?: string;
  branch_id?: string;
  stock_item_id?: string;
  quantity?: number;
  last_updated?: Date;
}

export function createTestStockLevel(options: CreateTestStockLevelOptions = {}): StockLevel {
  return {
    id: options.id ?? nextId(),
    branch_id: options.branch_id ?? nextId(),
    stock_item_id: options.stock_item_id ?? nextId(),
    quantity: options.quantity ?? Math.floor(Math.random() * 100) + 1,
    last_updated: options.last_updated ?? new Date(),
  };
}

// ---------- Sale Transaction Factory ----------

export interface CreateTestSaleTransactionOptions {
  id?: string;
  reference_number?: string;
  branch_id?: string;
  created_by?: string;
  total_amount?: number;
  transaction_date?: Date;
  created_at?: Date;
}

export function createTestSaleTransaction(options: CreateTestSaleTransactionOptions = {}): SaleTransaction {
  const now = new Date();
  return {
    id: options.id ?? nextId(),
    reference_number: options.reference_number ?? `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    branch_id: options.branch_id ?? nextId(),
    created_by: options.created_by ?? nextId(),
    total_amount: options.total_amount ?? parseFloat((Math.random() * 9999 + 1).toFixed(2)),
    transaction_date: options.transaction_date ?? now,
    created_at: options.created_at ?? now,
  };
}

// ---------- Sale Line Item Factory ----------

export interface CreateTestSaleLineItemOptions {
  id?: string;
  sale_transaction_id?: string;
  stock_item_id?: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
}

export function createTestSaleLineItem(options: CreateTestSaleLineItemOptions = {}): SaleLineItem {
  const quantity = options.quantity ?? Math.floor(Math.random() * 10) + 1;
  const unitPrice = options.unit_price ?? parseFloat((Math.random() * 100 + 1).toFixed(2));
  return {
    id: options.id ?? nextId(),
    sale_transaction_id: options.sale_transaction_id ?? nextId(),
    stock_item_id: options.stock_item_id ?? nextId(),
    quantity,
    unit_price: unitPrice,
    line_total: options.line_total ?? parseFloat((quantity * unitPrice).toFixed(2)),
  };
}

// ---------- Stock Transfer Factory ----------

export interface CreateTestStockTransferOptions {
  id?: string;
  source_branch_id?: string;
  destination_branch_id?: string;
  initiated_by?: string;
  status?: TransferStatus;
  created_at?: Date;
  confirmed_at?: Date | null;
}

export function createTestStockTransfer(options: CreateTestStockTransferOptions = {}): StockTransfer {
  const now = new Date();
  return {
    id: options.id ?? nextId(),
    source_branch_id: options.source_branch_id ?? nextId(),
    destination_branch_id: options.destination_branch_id ?? nextId(),
    initiated_by: options.initiated_by ?? nextId(),
    status: options.status ?? 'pending',
    created_at: options.created_at ?? now,
    confirmed_at: options.confirmed_at ?? null,
  };
}

// ---------- Transfer Line Item Factory ----------

export interface CreateTestTransferLineItemOptions {
  id?: string;
  stock_transfer_id?: string;
  stock_item_id?: string;
  quantity?: number;
}

export function createTestTransferLineItem(options: CreateTestTransferLineItemOptions = {}): TransferLineItem {
  return {
    id: options.id ?? nextId(),
    stock_transfer_id: options.stock_transfer_id ?? nextId(),
    stock_item_id: options.stock_item_id ?? nextId(),
    quantity: options.quantity ?? Math.floor(Math.random() * 100) + 1,
  };
}

// ---------- Audit Record Factory ----------

export interface CreateTestAuditRecordOptions {
  id?: string;
  user_id?: string;
  branch_id?: string;
  action_type?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  created_at?: Date;
}

export function createTestAuditRecord(options: CreateTestAuditRecordOptions = {}): AuditRecord {
  return {
    id: options.id ?? nextId(),
    user_id: options.user_id ?? nextId(),
    branch_id: options.branch_id ?? nextId(),
    action_type: options.action_type ?? 'stock_adjustment',
    description: options.description ?? 'Test audit record',
    metadata: options.metadata ?? null,
    created_at: options.created_at ?? new Date(),
  };
}
