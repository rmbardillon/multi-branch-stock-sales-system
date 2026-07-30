-- Migration 005: Create sale_transactions table
-- Requirements: 5.1

CREATE TABLE sale_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(50) NOT NULL UNIQUE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0.01 AND total_amount <= 999999999.99),
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_transactions_reference_number ON sale_transactions(reference_number);
CREATE INDEX idx_sale_transactions_branch_id ON sale_transactions(branch_id);
CREATE INDEX idx_sale_transactions_created_by ON sale_transactions(created_by);
CREATE INDEX idx_sale_transactions_transaction_date ON sale_transactions(transaction_date);
