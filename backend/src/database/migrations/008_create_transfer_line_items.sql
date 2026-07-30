-- Migration 008: Create transfer_line_items table
-- Requirements: 6.1

CREATE TABLE transfer_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 10000)
);

CREATE INDEX idx_transfer_line_items_stock_transfer_id ON transfer_line_items(stock_transfer_id);
CREATE INDEX idx_transfer_line_items_stock_item_id ON transfer_line_items(stock_item_id);
