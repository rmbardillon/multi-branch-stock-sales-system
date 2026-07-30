-- Migration 006: Create sale_line_items table
-- Requirements: 5.1

CREATE TABLE sale_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_transaction_id UUID NOT NULL REFERENCES sale_transactions(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0.01 AND unit_price <= 999999999.99),
    line_total DECIMAL(12, 2) NOT NULL CHECK (line_total >= 0.01)
);

CREATE INDEX idx_sale_line_items_sale_transaction_id ON sale_line_items(sale_transaction_id);
CREATE INDEX idx_sale_line_items_stock_item_id ON sale_line_items(stock_item_id);
