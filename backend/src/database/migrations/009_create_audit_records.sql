-- Migration 009: Create audit_records table
-- Requirements: 9.1

CREATE TABLE audit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_records_user_id ON audit_records(user_id);
CREATE INDEX idx_audit_records_branch_id ON audit_records(branch_id);
CREATE INDEX idx_audit_records_action_type ON audit_records(action_type);
CREATE INDEX idx_audit_records_created_at ON audit_records(created_at);
CREATE INDEX idx_audit_records_metadata ON audit_records USING GIN (metadata);
