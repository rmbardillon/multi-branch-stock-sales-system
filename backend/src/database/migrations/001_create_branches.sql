-- Migration 001: Create branches table
-- Requirements: 2.1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_status ON branches(status);
CREATE INDEX idx_branches_name ON branches(name);
