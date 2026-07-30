"use client";

import { DollarSign, AlertTriangle, Package, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";
import { useAuthContext } from "@/providers/auth-provider";
import { useSalesReport } from "@/hooks/use-reports";
import { useLowStockAlerts } from "@/hooks/use-inventory";
import { useSales, type SaleTransaction } from "@/hooks/use-sales";

function getStartOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { user } = useAuthContext();

  const isAdmin = user?.role === "Admin";
  const isBranchManager = user?.role === "Branch_Manager";
  const branchId = user?.assignedBranchId;

  // Sales report for the current month, scoped by role
  const salesFilters = {
    startDate: getStartOfMonth(),
    endDate: getToday(),
    ...((!isAdmin && branchId) ? { branchId } : {}),
  };
  const { data: salesReport, isLoading: salesLoading } = useSalesReport(salesFilters);

  // Low stock alerts scoped by role
  const alertsBranchId = isAdmin ? null : branchId;
  const { data: alerts } = useLowStockAlerts(alertsBranchId);

  // Recent transactions (20 most recent)
  // For Admin without an assigned branch, we skip this query since there's no
  // "all" branch endpoint on the backend.
  const recentBranchId = isAdmin ? branchId : branchId;
  const { data: recentSalesData, isLoading: recentLoading } = useSales(
    recentBranchId || null,
    { pageSize: 20 }
  );

  const totalSales = salesReport?.total_revenue ?? 0;
  const lowStockCount = alerts?.length ?? 0;
  const totalItems = salesReport?.total_quantity ?? 0;
  const recentTransactions: SaleTransaction[] = recentSalesData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          {isAdmin
            ? "Overview of all branches"
            : isBranchManager
            ? "Overview of your branch"
            : "Your sales overview"}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sales (This Month)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(totalSales)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockCount === 0
                ? "All items adequately stocked"
                : `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} below threshold`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Items Sold (This Month)
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-2xl font-bold">{totalItems}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts Widget */}
        <LowStockAlerts branchId={alertsBranchId} />

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </div>
              {recentTransactions.length > 0 && (
                <Badge variant="secondary">
                  {recentTransactions.length} latest
                </Badge>
              )}
            </div>
            <CardDescription>
              The 20 most recent sale transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLoading && (
              <p className="text-sm text-muted-foreground">
                Loading transactions...
              </p>
            )}
            {!recentLoading && recentTransactions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recent transactions.
              </p>
            )}
            {!recentLoading && recentTransactions.length > 0 && (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium font-mono text-xs">
                        {tx.reference_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(tx.transaction_date)}
                      </div>
                    </div>
                    <div className="ml-4 shrink-0 font-semibold">
                      {formatCurrency(tx.total_amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
