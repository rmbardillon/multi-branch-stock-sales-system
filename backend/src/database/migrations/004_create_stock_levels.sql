-- Migration 004: Create stock_levels table
-- Requirements: 4.1

CREATE TABLE stock_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_levels_branch_item UNIQUE (branch_id, stock_item_id)
);

CREATE INDEX idx_stock_levels_branch_id ON stock_levels(branch_id);
CREATE INDEX idx_stock_levels_stock_item_id ON stock_levels(stock_item_id);
CREATE INDEX idx_stock_levels_quantity ON stock_levels(quantity);
