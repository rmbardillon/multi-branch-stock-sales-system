import { describe, it, expect } from 'vitest';
import {
  createTestBranch,
  createTestUser,
  createTestStockItem,
  createTestStockLevel,
  createTestSaleTransaction,
  createTestSaleLineItem,
  createTestStockTransfer,
  createTestTransferLineItem,
  createTestAuditRecord,
} from '../factories';

describe('Test Factories', () => {
  describe('createTestBranch', () => {
    it('should create a branch with all required fields', () => {
      const branch = createTestBranch();
      expect(branch.id).toBeDefined();
      expect(branch.name).toBeDefined();
      expect(branch.address).toBeDefined();
      expect(branch.contact_number).toBeDefined();
      expect(branch.status).toBe('Active');
      expect(branch.created_at).toBeInstanceOf(Date);
      expect(branch.updated_at).toBeInstanceOf(Date);
    });

    it('should allow overriding fields', () => {
      const branch = createTestBranch({ name: 'Custom Branch', status: 'Inactive' });
      expect(branch.name).toBe('Custom Branch');
      expect(branch.status).toBe('Inactive');
    });

    it('should generate unique IDs', () => {
      const b1 = createTestBranch();
      const b2 = createTestBranch();
      expect(b1.id).not.toBe(b2.id);
    });
  });

  describe('createTestUser', () => {
    it('should create a user with default Sales_Staff role', () => {
      const user = createTestUser();
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.role).toBe('Sales_Staff');
      expect(user.is_active).toBe(true);
      expect(user.failed_login_attempts).toBe(0);
      expect(user.locked_until).toBeNull();
    });

    it('should allow overriding role', () => {
      const admin = createTestUser({ role: 'Admin' });
      expect(admin.role).toBe('Admin');
    });
  });

  describe('createTestStockItem', () => {
    it('should create a stock item with valid data', () => {
      const item = createTestStockItem();
      expect(item.id).toBeDefined();
      expect(item.sku).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.unit_price).toBeGreaterThan(0);
      expect(item.low_stock_threshold).toBe(10);
      expect(item.is_active).toBe(true);
    });
  });

  describe('createTestStockLevel', () => {
    it('should create a stock level with positive quantity', () => {
      const level = createTestStockLevel();
      expect(level.id).toBeDefined();
      expect(level.branch_id).toBeDefined();
      expect(level.stock_item_id).toBeDefined();
      expect(level.quantity).toBeGreaterThanOrEqual(1);
      expect(level.last_updated).toBeInstanceOf(Date);
    });
  });

  describe('createTestSaleTransaction', () => {
    it('should create a sale transaction with a reference number', () => {
      const sale = createTestSaleTransaction();
      expect(sale.id).toBeDefined();
      expect(sale.reference_number).toMatch(/^TXN-/);
      expect(sale.total_amount).toBeGreaterThan(0);
    });
  });

  describe('createTestSaleLineItem', () => {
    it('should calculate line total correctly', () => {
      const item = createTestSaleLineItem({ quantity: 3, unit_price: 10.5 });
      expect(item.quantity).toBe(3);
      expect(item.unit_price).toBe(10.5);
      expect(item.line_total).toBe(31.5);
    });
  });

  describe('createTestStockTransfer', () => {
    it('should create a pending transfer', () => {
      const transfer = createTestStockTransfer();
      expect(transfer.status).toBe('pending');
      expect(transfer.confirmed_at).toBeNull();
      expect(transfer.source_branch_id).not.toBe(transfer.destination_branch_id);
    });
  });

  describe('createTestTransferLineItem', () => {
    it('should create a transfer line item with positive quantity', () => {
      const item = createTestTransferLineItem();
      expect(item.quantity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('createTestAuditRecord', () => {
    it('should create an audit record with required fields', () => {
      const record = createTestAuditRecord();
      expect(record.user_id).toBeDefined();
      expect(record.branch_id).toBeDefined();
      expect(record.action_type).toBe('stock_adjustment');
      expect(record.created_at).toBeInstanceOf(Date);
    });
  });
});
