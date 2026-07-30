-- Migration 007: Create stock_transfers table
-- Requirements: 6.1

CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_transfer_different_branches CHECK (source_branch_id != destination_branch_id)
);

CREATE INDEX idx_stock_transfers_source_branch_id ON stock_transfers(source_branch_id);
CREATE INDEX idx_stock_transfers_destination_branch_id ON stock_transfers(destination_branch_id);
CREATE INDEX idx_stock_transfers_initiated_by ON stock_transfers(initiated_by);
CREATE INDEX idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX idx_stock_transfers_created_at ON stock_transfers(created_at);
