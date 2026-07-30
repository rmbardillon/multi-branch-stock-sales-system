# Developer Guide — Multi-Branch Stock & Sales Management System

## Overview

This is a full-stack web application for managing stock and sales across multiple business branches. It allows businesses to track inventory, process sales, transfer stock between locations, and generate reports — all governed by role-based access control.

**Tech Stack:**
- Frontend: Next.js 14 (App Router), React, TanStack Query, ShadCN UI, Tailwind CSS
- Backend: Node.js + Express, TypeScript
- Database: PostgreSQL
- Auth: JWT + bcrypt

---

## Project Structure

```
Project/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── index.ts           # App entry point (Express setup, CORS, routes)
│   │   ├── database/
│   │   │   ├── connection.ts  # PostgreSQL pool + helpers (query, withTransaction)
│   │   │   ├── migrate.ts     # Migration runner
│   │   │   ├── migrations/    # SQL migration files (001-009)
│   │   │   └── seeds/seed.ts  # Test data seeder
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts   # JWT validation, session timeout
│   │   │   └── rbac.middleware.ts   # Role-based permission checks
│   │   ├── routes/            # Express route files (one per module)
│   │   ├── services/          # Business logic (one per module)
│   │   └── types/             # TypeScript types, DTOs, Zod schemas, RBAC
│   ├── tests/                 # Vitest tests (unit, property-based)
│   ├── .env                   # Environment variables (not committed)
│   └── package.json
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── (auth)/        # Login page (no sidebar)
│   │   │   └── (dashboard)/   # All authenticated pages (with sidebar)
│   │   ├── components/
│   │   │   ├── ui/            # ShadCN primitives (Button, Input, Table, etc.)
│   │   │   ├── data-table/    # DataTable components per module
│   │   │   ├── forms/         # Form dialogs per module
│   │   │   ├── dashboard/     # Dashboard widgets
│   │   │   └── layout/        # NetworkBanner
│   │   ├── hooks/             # TanStack Query hooks (one per module)
│   │   ├── lib/               # Utilities (api-client, validators, toast)
│   │   └── providers/         # React context providers (Auth, Query)
│   └── package.json
├── e2e/                        # Playwright E2E tests
└── package.json                # Root (workspaces)
```

---

## How the Backend Works

### Request Flow

```
Client Request
    → Express middleware (CORS, JSON parsing)
    → Auth Middleware (validates JWT, attaches user to request)
    → RBAC Middleware (checks user role has required permission)
    → Route Handler (validates input with Zod, calls service)
    → Service (business logic, database queries)
    → PostgreSQL
    → Response back to client
```

### Key Files Explained

| File | Purpose |
|------|---------|
| `src/index.ts` | Sets up Express, applies middleware, mounts routes |
| `src/routes/index.ts` | Combines all route modules under `/api` |
| `src/middleware/auth.middleware.ts` | Extracts JWT from `Authorization: Bearer <token>`, validates it, checks session timeout (30 min), updates `last_activity` |
| `src/middleware/rbac.middleware.ts` | `requirePermission('sales:create')` — checks if the user's role has that permission. `requireAdmin()` — shortcut for admin-only routes |
| `src/database/connection.ts` | PostgreSQL connection pool. Exports `query()` for simple queries, `withTransaction()` for atomic operations |

### Services (Business Logic)

Each service handles one domain. They are singletons exported from their files.

| Service | File | Key Methods |
|---------|------|-------------|
| AuthService | `auth.service.ts` | `authenticate()`, `validateSession()`, `lockAccount()` |
| BranchService | `branch.service.ts` | `create()`, `update()`, `deactivate()`, `list()`, `getById()` |
| StockService | `stock.service.ts` | `createItem()`, `search()`, `getStockLevels()`, `getLowStockAlerts()` |
| SalesService | `sales.service.ts` | `createTransaction()`, `getTransactions()`, `calculateTotal()` |
| TransferService | `transfer.service.ts` | `initiate()`, `confirm()`, `getTransfers()` |
| ReportService | `report.service.ts` | `generateSalesReport()`, `generateStockReport()`, `exportToCsv()` |
| AuditService | `audit.service.ts` | `log()`, `query()` — with retry logic and dead-letter queue |
| UserService | `user.service.ts` | `create()`, `update()`, `assignRole()`, `list()` |

### How Transactions Work (Critical)

For stock-affecting operations (sales, transfers), we use **pessimistic locking** to prevent race conditions:

```typescript
// Inside sales.service.ts createTransaction()
return withTransaction(async (client) => {
  // 1. Lock the stock rows (no other transaction can modify them)
  await client.query(
    'SELECT quantity FROM stock_levels WHERE branch_id = $1 AND stock_item_id = ANY($2) FOR UPDATE',
    [branchId, itemIds]
  );
  
  // 2. Check if stock is sufficient
  // 3. Deduct stock
  // 4. Create sale record
  // 5. COMMIT (or ROLLBACK if anything fails)
});
```

The `withTransaction()` helper automatically calls COMMIT on success and ROLLBACK on error.

---

## How the Frontend Works

### Page Structure (App Router)

```
src/app/
├── layout.tsx                  # Root layout (providers: Query + Auth + Toaster)
├── (auth)/
│   ├── layout.tsx             # Centered layout, no sidebar
│   └── login/page.tsx         # Login form
└── (dashboard)/
    ├── layout.tsx             # Sidebar + main content area
    ├── page.tsx               # Dashboard (metrics, alerts, recent transactions)
    ├── branches/page.tsx      # Branch management (Admin only)
    ├── stock-items/page.tsx   # Stock items CRUD
    ├── inventory/page.tsx     # Stock levels per branch
    ├── sales/
    │   ├── page.tsx           # Sales list
    │   └── new/page.tsx       # Create new sale
    ├── transfers/
    │   ├── page.tsx           # Transfers list
    │   └── new/page.tsx       # Initiate transfer
    ├── reports/page.tsx       # Sales/stock reports + CSV export
    ├── users/page.tsx         # User management (Admin only)
    └── audit/page.tsx         # Audit trail (Admin only)
```

### Data Fetching Pattern

Every page uses **TanStack Query hooks** (in `src/hooks/`) to fetch and mutate data. These hooks call the backend API through `src/lib/api-client.ts`.

```
Page Component
    → uses hook (e.g., useBranches())
    → hook calls apiClient.get('/branches')
    → apiClient attaches JWT token from localStorage
    → fetch() to backend
    → hook returns { data, isLoading, error }
    → component renders based on state
```

**Example hook:**
```typescript
// src/hooks/use-branches.ts
export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient.get('/branches'),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiClient.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] }); // refetch list
    },
  });
}
```

### Form Pattern

All forms use **react-hook-form** + **Zod** for validation:

```typescript
const form = useForm({
  resolver: zodResolver(branchSchema),  // Zod schema validates
  defaultValues: { name: '', address: '', ... },
});

function onSubmit(data) {
  createBranch.mutate(data);  // calls the mutation hook
}
```

### DataTable Pattern

All list pages use a reusable DataTable pattern with **TanStack Table**:

```typescript
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});
```

---

## Authentication Flow

1. User submits login form → POST `/api/auth/login`
2. Backend verifies credentials (bcrypt), generates JWT
3. Frontend stores token in `localStorage` + cookie (for Next.js middleware)
4. Every API call includes `Authorization: Bearer <token>` header
5. Backend auth middleware validates token on each request
6. If token expired or invalid → 401 → frontend redirects to `/login`
7. Session timeout: if no activity for 30 minutes, session is invalidated

### Account Lockout
- 3 failed login attempts within 30 minutes → account locked for 15 minutes
- Error message is always "Invalid username or password" (never reveals which is wrong)

---

## Role-Based Access Control (RBAC)

Three roles with different permissions:

| Role | Can Do | Branch Scope |
|------|--------|--------------|
| **Admin** | Everything | All branches |
| **Branch_Manager** | Inventory, stock items, transfers, reports, view sales | Own branch only |
| **Sales_Staff** | Create/view sales, view inventory | Own branch only |

### How it's enforced:

**Backend:** Route-level middleware
```typescript
router.post('/', requirePermission('sales:create', (req) => req.body.branch_id));
```

**Frontend:** UI-level visibility
```typescript
const isAdmin = user?.role === 'Admin';
{isAdmin && <Button>Create Branch</Button>}
```

Both layers must agree. The frontend hides buttons, but the backend enforces permissions even if someone calls the API directly.

---

## Database Schema

9 tables with foreign key relationships:

```
branches ──┐
            ├── users (assigned_branch_id → branches)
            ├── stock_levels (branch_id → branches)
            ├── sale_transactions (branch_id → branches)
            └── stock_transfers (source/destination → branches)

stock_items ──┐
              ├── stock_levels (stock_item_id → stock_items)
              ├── sale_line_items (stock_item_id → stock_items)
              └── transfer_line_items (stock_item_id → stock_items)

sale_transactions ── sale_line_items
stock_transfers ── transfer_line_items
audit_records (logs all operations)
```

### Key Constraints:
- `stock_levels.quantity >= 0` (stock can never go negative)
- `stock_levels (branch_id, stock_item_id)` is UNIQUE (one level per item per branch)
- `branches.name` is UNIQUE
- `stock_items.sku` is UNIQUE
- `stock_transfers: source_branch_id != destination_branch_id`

---

## Adding a New Feature (Step by Step)

Example: Adding a "Purchase Orders" module.

### Backend:
1. **Create migration** — `backend/src/database/migrations/010_create_purchase_orders.sql`
2. **Add types** — Add interfaces to `types/entities.ts` and DTOs to `types/dtos.ts`
3. **Add Zod schema** — In `types/schemas.ts`
4. **Create service** — `services/purchase-order.service.ts` with business logic
5. **Create routes** — `routes/purchase-order.routes.ts` with Express handlers
6. **Register route** — In `routes/index.ts`: `router.use('/purchase-orders', authMiddleware, purchaseOrderRoutes)`

### Frontend:
7. **Create hook** — `hooks/use-purchase-orders.ts` with TanStack Query hooks
8. **Create page** — `app/(dashboard)/purchase-orders/page.tsx`
9. **Create DataTable** — `components/data-table/purchase-orders-table.tsx`
10. **Create form** — `components/forms/purchase-order-form.tsx`
11. **Add nav item** — In `app/(dashboard)/layout.tsx`, add to `navItems` array

---

## Environment Variables

### Backend (.env)
```
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/stock_sales_db
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=8h
DB_POOL_MAX=20
DB_POOL_MIN=2
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Running the Project

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up database
cd backend
npm run db:migrate    # creates tables
npm run db:seed       # adds test data

# Start development
cd backend && npm run dev      # starts on port 3001
cd frontend && npm run dev     # starts on port 3000
```

### Test Credentials (from seed):
| Username | Password | Role |
|----------|----------|------|
| admin | Admin123 | Admin |
| manager_main | Manager123 | Branch_Manager (Main Branch) |
| manager_north | Manager123 | Branch_Manager (North Branch) |
| staff_main | Staff123 | Sales_Staff (Main Branch) |
| staff_north | Staff123 | Sales_Staff (North Branch) |

---

## Common Patterns to Follow

### Error Handling
- Backend services throw typed errors: `throw new BranchServiceError('Not found', 404)`
- Routes catch these and return structured JSON: `{ error, message, details? }`
- Frontend shows toast notifications globally (via TanStack Query's MutationCache)

### Query Invalidation
When a mutation succeeds, invalidate related queries so the UI refreshes:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['sales'] });
  queryClient.invalidateQueries({ queryKey: ['inventory'] }); // stock changed too
}
```

### Pagination
Backend returns: `{ transactions: [...], total, page, pageSize, totalPages }`
Frontend DataTables support client-side or server-side pagination depending on data volume.

---

## Testing

```bash
# Backend tests (unit + property-based)
cd backend && npm test

# Individual test file
cd backend && npx vitest run tests/property/sales-transaction.property.spec.ts
```

Property-based tests use **fast-check** to generate random inputs and verify correctness properties hold for all cases (minimum 100 iterations each).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module '../types/express'` | Remove `import '../types/express'` from auth.middleware.ts — .d.ts files auto-load |
| Login shows "session expired" | The URL has `?session_expired=true`. Normal behavior after timeout |
| API returns 401 | Token expired or missing. Check localStorage has `auth_token` |
| "Cannot read properties of undefined" | Usually a backend response shape mismatch. Check the hook's interface matches what the API actually returns |
| Database connection refused | Check `.env` DATABASE_URL matches your PostgreSQL setup |
| Stock operations fail silently | Check if branch is Active. Inactive branches block new sales/transfers |
