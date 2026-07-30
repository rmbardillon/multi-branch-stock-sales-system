# Implementation Plan: Multi-Branch Stock Monitoring and Sales Management System

## Overview

This plan implements a full-stack web application for multi-branch stock monitoring and sales management. The system uses Next.js 14+ (App Router) with ShadCN UI for the frontend, Node.js + Express for the REST API backend, PostgreSQL for the database, JWT authentication with RBAC, and comprehensive testing with Vitest, Playwright, and fast-check. Tasks are ordered to build foundational layers first (database, types, auth) then progressively add domain features (branches, stock, sales, transfers, reports, audit) with testing woven throughout.

## Tasks

- [x] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize project structure with Next.js 14+ App Router and Express backend
    - Create monorepo structure with `frontend/` (Next.js) and `backend/` (Express) directories
    - Initialize Next.js with App Router, TypeScript, Tailwind CSS
    - Initialize Express backend with TypeScript
    - Install ShadCN UI, TanStack Query, react-hook-form, zod
    - Install backend dependencies: express, pg, jsonwebtoken, bcrypt, uuid
    - Configure TypeScript, ESLint, path aliases for both projects
    - _Requirements: 10.1, 10.2_

  - [x] 1.2 Set up PostgreSQL database schema and migrations
    - Create migration files for all tables: users, branches, stock_items, stock_levels, sale_transactions, sale_line_items, stock_transfers, transfer_line_items, audit_records
    - Define all constraints, indexes, unique keys, foreign keys, and CHECK constraints per data model
    - Create seed script for initial Admin user and test data
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 9.1_

  - [x] 1.3 Implement shared TypeScript types and interfaces
    - Create shared types for all entities: User, Branch, StockItem, StockLevel, SaleTransaction, SaleLineItem, StockTransfer, TransferLineItem, AuditRecord
    - Define DTOs for create/update operations
    - Define Zod validation schemas for all inputs
    - Define RBAC permission types and role-permission matrix
    - _Requirements: 8.1, 8.2_

  - [x] 1.4 Set up testing infrastructure
    - Configure Vitest for unit and integration tests (backend and frontend)
    - Configure React Testing Library for component tests
    - Configure fast-check for property-based tests
    - Configure Playwright for E2E tests
    - Create test utilities, factories, and database fixtures
    - _Requirements: All_

- [x] 2. Authentication and authorization layer
  - [x] 2.1 Implement authentication service and JWT middleware
    - Create AuthService with authenticate(), validateSession(), lockAccount(), unlockAccount()
    - Implement bcrypt password hashing and verification
    - Implement JWT token generation and validation
    - Implement account lockout logic (3 failed attempts in 30 minutes → 15-minute lock)
    - Implement session timeout (30 minutes of inactivity)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x] 2.2 Write property test for password validation
    - **Property 1: Password Validation Correctness**
    - **Validates: Requirements 1.4**

  - [x] 2.3 Write property test for invalid credentials error uniformity
    - **Property 2: Invalid Credentials Produce Uniform Error**
    - **Validates: Requirements 1.2**

  - [x] 2.4 Implement RBAC middleware and permission checking
    - Create RBAC middleware that checks role permissions per endpoint
    - Implement branch-scoped access enforcement (Branch_Manager, Sales_Staff see only their branch)
    - Implement permission matrix: Admin gets all, Branch_Manager gets inventory/transfer/report, Sales_Staff gets sales/inventory-read
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 2.5 Write property tests for RBAC enforcement
    - **Property 23: Role-Permission Enforcement**
    - **Property 24: Single Role Invariant**
    - **Property 25: Branch-Scoped Role Requires Branch Assignment**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

  - [x] 2.6 Implement auth API endpoints and login page
    - Create POST `/api/auth/login` and POST `/api/auth/logout` endpoints
    - Create Next.js login page with react-hook-form + Zod validation
    - Implement Next.js middleware for route protection and session enforcement
    - Create AuthProvider context for client-side session state
    - Create `use-auth.ts` hook with TanStack Query
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Checkpoint - Auth and RBAC foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Branch management module
  - [x] 4.1 Implement branch service and API endpoints
    - Create BranchService with create(), update(), deactivate(), list(), getById()
    - Create API endpoints: GET/POST `/api/branches`, GET/PUT/PATCH `/api/branches/:id`
    - Implement branch name uniqueness validation
    - Implement deactivation with pending transaction warning
    - Apply RBAC: Admin-only for create/update/deactivate
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.2 Write property tests for branch management
    - **Property 3: Branch Data Persistence Round-Trip**
    - **Property 4: Branch Validation Rejects Invalid Input**
    - **Property 5: Branch Name Uniqueness**
    - **Property 6: Deactivated Branch Blocks New Operations**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**

  - [x] 4.3 Implement branch management UI pages
    - Create branches list page with DataTable (ShadCN + TanStack Table)
    - Create branch create/edit dialog with react-hook-form + Zod
    - Create branch deactivation confirmation AlertDialog
    - Implement `use-branches.ts` TanStack Query hook
    - Support sorting, filtering, pagination for 500+ branches
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Stock item management module
  - [x] 5.1 Implement stock item service and API endpoints
    - Create StockService with createItem(), updateItem(), search(), getStockLevel(), getStockLevels(), getConsolidatedView(), getLowStockAlerts()
    - Create API endpoints: GET/POST `/api/stock-items`, GET/PUT `/api/stock-items/:id`, GET `/api/stock-items/search`
    - Implement SKU uniqueness validation
    - Implement case-insensitive partial search by SKU, name, category
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Write property tests for stock item management
    - **Property 7: Stock Item Data Persistence Round-Trip**
    - **Property 8: SKU Uniqueness**
    - **Property 9: Stock Item Search Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 5.3 Implement stock item management UI pages
    - Create stock items list page with DataTable
    - Create stock item create/edit dialog with form validation
    - Implement search functionality with debounced input
    - Implement `use-stock-items.ts` TanStack Query hook
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Inventory monitoring module
  - [x] 6.1 Implement inventory monitoring service and API endpoints
    - Create API endpoints: GET `/api/inventory/:branchId`, GET `/api/inventory/consolidated/:itemId`, GET `/api/inventory/alerts`
    - Implement low-stock alert generation when quantity < threshold
    - Implement alert removal when quantity restored >= threshold
    - Implement consolidated cross-branch stock view
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.2 Write property test for low-stock alert threshold invariant
    - **Property 10: Low-Stock Alert Threshold Invariant**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 6.3 Implement inventory monitoring UI pages
    - Create inventory page showing stock levels per branch with DataTable
    - Create consolidated view for cross-branch stock levels
    - Create low-stock alerts display on Dashboard
    - Implement stale data notification with last-updated timestamp
    - Implement `use-inventory.ts` TanStack Query hook with refetch intervals
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 7. Checkpoint - Core data modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Sales transaction module
  - [x] 8.1 Implement sales service with transactional stock deduction
    - Create SalesService with createTransaction(), getTransactions(), calculateTotal()
    - Implement PostgreSQL transaction with SELECT ... FOR UPDATE for stock locking
    - Implement atomic stock deduction for all line items
    - Implement insufficient stock rejection (entire transaction fails if any item insufficient)
    - Implement unique reference number generation
    - Implement total calculation: sum of (quantity × unit_price) rounded to 2 decimal places
    - Validate: minimum 1 line item, quantity >= 1, branch is active
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 8.2 Write property tests for sales transactions
    - **Property 11: Sale Transaction Stock Deduction**
    - **Property 12: Insufficient Stock Rejects Entire Sale**
    - **Property 13: Sale Total Calculation**
    - **Property 14: Transaction Reference Uniqueness**
    - **Property 15: Concurrent Sales Never Oversell Stock**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7**

  - [x] 8.3 Implement sales API endpoints
    - Create POST `/api/sales` for creating sale transactions
    - Create GET `/api/sales/:branchId` for listing sales with filters
    - Apply RBAC: Sales_Staff can create sales at their branch, Branch_Manager and Admin can view
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.4 Implement sales transaction UI pages
    - Create sales list page with DataTable, filtering by date range
    - Create new sale page with stock item search, line item management
    - Implement real-time stock availability check during sale creation
    - Display transaction reference upon successful completion
    - Implement `use-sales.ts` TanStack Query hook
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.5 Write property test for stock level non-negativity
    - **Property 28: Stock Level Non-Negativity Invariant**
    - **Validates: Requirements 5.3, 6.3**

- [x] 9. Stock transfer module
  - [x] 9.1 Implement stock transfer service with atomic operations
    - Create TransferService with initiate(), confirm(), getTransfers()
    - Implement atomic transfer: deduct from source + add to destination within single transaction
    - Implement SELECT ... FOR UPDATE on both source and destination stock rows
    - Validate: source != destination, initiator assigned to source branch, quantity > 0, max 50 line items, quantity 1-10000
    - Implement transfer status tracking: pending → confirmed/failed
    - On system error, preserve original stock levels and set status to "failed"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 9.2 Write property tests for stock transfers
    - **Property 16: Stock Transfer Conservation**
    - **Property 17: Transfer Rejects Insufficient Source Stock**
    - **Property 18: Transfer Validation Rules**
    - **Property 19: Failed Transfer Preserves Stock Levels**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.6**

  - [x] 9.3 Implement stock transfer API endpoints
    - Create POST `/api/transfers` for initiating transfers
    - Create POST `/api/transfers/:id/confirm` for confirming transfers
    - Create GET `/api/transfers/:branchId` for listing transfers
    - Apply RBAC: Branch_Manager can initiate/confirm for their branch
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.4 Implement stock transfer UI pages
    - Create transfers list page with DataTable and status badges
    - Create new transfer form with source/destination branch selection
    - Implement line item management (up to 50 items) with quantity validation
    - Implement transfer confirmation flow
    - Implement `use-transfers.ts` TanStack Query hook
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Checkpoint - Transaction modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Dashboard and reporting module
  - [x] 11.1 Implement report service and API endpoints
    - Create ReportService with generateSalesReport(), generateStockReport(), exportToCsv()
    - Create GET `/api/reports/sales` with date range, branch, category filters
    - Create GET `/api/reports/stock` with date range and branch filters
    - Create GET `/api/reports/export` for CSV download
    - Implement Admin aggregation across all branches
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 11.2 Write property tests for reporting
    - **Property 20: Admin Dashboard Aggregation**
    - **Property 21: Report Filter Accuracy**
    - **Property 22: CSV Export Round-Trip**
    - **Validates: Requirements 7.2, 7.3, 7.5**

  - [x] 11.3 Implement dashboard UI page
    - Create dashboard page with metric cards (total sales, low-stock count, recent transactions)
    - Implement Admin view with aggregated metrics across all branches
    - Implement Branch_Manager view scoped to assigned branch
    - Display up to 50 low-stock items and 20 most recent transactions
    - Implement `use-reports.ts` TanStack Query hook
    - _Requirements: 7.1, 7.2_

  - [x] 11.4 Implement reports UI pages
    - Create reports page with filter form (date range up to 365 days, branch, category)
    - Create sales report table showing item name, quantity sold, revenue per item
    - Create stock report table showing current levels, movement history, low-stock items
    - Implement CSV export button with download
    - Handle empty results with informational message
    - Handle export failure with error toast
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 12. Audit trail module
  - [x] 12.1 Implement audit service with retry logic
    - Create AuditService with log() and query() methods
    - Implement audit logging for all stock adjustments, sales, and transfers
    - Implement retry logic: immediate → 1s delay → 5s delay → dead-letter queue
    - Implement background worker for dead-letter queue processing (60s interval)
    - Never discard audit entries
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 12.2 Write property tests for audit trail
    - **Property 26: Audit Record Completeness**
    - **Property 27: Audit Query Filter Accuracy**
    - **Validates: Requirements 9.1, 9.3**

  - [x] 12.3 Implement audit API endpoints and UI
    - Create GET `/api/audit` with filters (date range, user, branch, action type)
    - Apply RBAC: Admin-only access
    - Create audit trail page with filterable DataTable
    - Return results within 5 seconds for queries spanning up to 12 months
    - Handle empty results with informational message
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. User management module
  - [x] 13.1 Implement user management service and API endpoints
    - Create API endpoints: GET/POST `/api/users`, GET/PUT `/api/users/:id`, PUT `/api/users/:id/role`
    - Implement role assignment with validation (branch-scoped roles require branch assignment)
    - Implement immediate permission update on role change
    - Apply RBAC: Admin-only for user management
    - _Requirements: 8.1, 8.2, 8.7_

  - [x] 13.2 Implement user management UI page
    - Create users list page with DataTable (Admin only)
    - Create user create/edit dialog with role and branch assignment
    - Implement role assignment with branch validation
    - Display user status, role, assigned branch
    - _Requirements: 8.1, 8.2, 8.7_

- [x] 14. Responsive layout and navigation
  - [x] 14.1 Implement responsive dashboard layout with sidebar navigation
    - Create root layout with providers (Auth, QueryClient, Theme)
    - Create dashboard layout with collapsible sidebar (ShadCN Sidebar component)
    - Implement mobile layout (≤767px): sales and stock viewing as primary nav items, one tap access
    - Implement desktop layout (≥768px): full navigation with reporting and administration
    - Implement 320px minimum width check with unsupported message
    - Ensure no horizontal scrolling from 320px to 2560px
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [x] 14.2 Implement role-based navigation visibility
    - Show/hide navigation items based on user role
    - Admin: all items visible
    - Branch_Manager: inventory, transfers, reports, dashboard
    - Sales_Staff: sales, stock viewing, dashboard
    - _Requirements: 8.3, 8.4, 8.5, 10.3, 10.4_

- [x] 15. Checkpoint - All modules integrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Error handling and edge cases
  - [x] 16.1 Implement comprehensive error handling
    - Implement backend error classification (400, 401, 403, 404, 409, 422, 500, 503)
    - Implement frontend toast notifications for API errors (ShadCN Toast/Sonner)
    - Implement inline form validation errors with FormMessage component
    - Implement network connectivity Alert banner
    - Implement session expiry redirect with "session expired" toast
    - Handle insufficient stock with available quantity display (422)
    - Handle uniqueness conflicts (409)
    - _Requirements: 1.2, 1.3, 2.2, 2.7, 3.3, 3.5, 5.3, 5.6, 6.3, 6.4, 7.6, 7.7, 8.6_

  - [x] 16.2 Write unit tests for error handling
    - Test validation error display
    - Test session expiry redirect
    - Test network error banner
    - Test toast notification rendering
    - _Requirements: 1.2, 1.3, 5.3, 6.3_

- [x] 17. Integration wiring and end-to-end validation
  - [x] 17.1 Wire all frontend hooks to backend API endpoints
    - Ensure all TanStack Query hooks connect to correct endpoints
    - Implement optimistic updates where appropriate
    - Implement query invalidation on mutations (stock levels after sale/transfer)
    - Verify API client auth header injection
    - _Requirements: All_

  - [x] 17.2 Write integration tests for critical API flows
    - Test full authentication flow (login → session → logout)
    - Test sale creation with stock deduction
    - Test transfer with atomic stock update
    - Test concurrent sale handling
    - Test RBAC enforcement across endpoints
    - _Requirements: 1.1, 5.2, 5.7, 6.2, 8.2_

  - [x] 17.3 Write E2E tests with Playwright
    - Test complete sales workflow (login → search → create sale → verify stock)
    - Test stock transfer workflow (initiate → confirm → verify both branches)
    - Test report generation and CSV export
    - Test role-based navigation visibility
    - Test account lockout and recovery flow
    - Test responsive layout at 320px, 767px, 768px, 1024px, 2560px viewports
    - _Requirements: 1.1, 1.3, 5.1, 6.1, 7.5, 8.3, 8.4, 8.5, 10.1, 10.3, 10.4_

- [x] 18. Final checkpoint - All tests pass and system is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breakpoints
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific edge cases and error conditions using Vitest + React Testing Library
- Integration tests verify full API flows using Supertest + PostgreSQL
- E2E tests cover complete user workflows using Playwright
- The system uses pessimistic locking (SELECT ... FOR UPDATE) for all stock-affecting operations to prevent race conditions
- All stock-affecting operations (sales, transfers) must be implemented within PostgreSQL transactions for atomicity

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6"] },
    { "id": 5, "tasks": ["4.1", "5.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "5.2", "5.3"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3"] },
    { "id": 11, "tasks": ["8.4", "8.5", "9.1"] },
    { "id": 12, "tasks": ["9.2", "9.3"] },
    { "id": 13, "tasks": ["9.4", "11.1"] },
    { "id": 14, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 15, "tasks": ["12.1"] },
    { "id": 16, "tasks": ["12.2", "12.3", "13.1"] },
    { "id": 17, "tasks": ["13.2", "14.1"] },
    { "id": 18, "tasks": ["14.2", "16.1"] },
    { "id": 19, "tasks": ["16.2", "17.1"] },
    { "id": 20, "tasks": ["17.2", "17.3"] }
  ]
}
```
