"use client";

import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLowStockAlerts, type LowStockAlert } from "@/hooks/use-inventory";

interface LowStockAlertsProps {
  branchId?: string | null;
}

export function LowStockAlerts({ branchId }: LowStockAlertsProps) {
  const { data: alerts, isLoading, isError } = useLowStockAlerts(branchId);

  const displayAlerts = alerts?.slice(0, 50) ?? [];
  const totalCount = alerts?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
          </div>
          {totalCount > 0 && (
            <Badge variant="warning">{totalCount} items</Badge>
          )}
        </div>
        <CardDescription>
          Items below their configured low stock threshold
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading alerts...</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            Failed to load low stock alerts.
          </p>
        )}
        {!isLoading && !isError && displayAlerts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            All items are adequately stocked.
          </p>
        )}
        {!isLoading && !isError && displayAlerts.length > 0 && (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {displayAlerts.map((alert: LowStockAlert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{alert.item_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {alert.branch_name} &middot; SKU: {alert.sku}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className="text-destructive font-semibold">
                    {alert.current_quantity}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">
                    {alert.low_stock_threshold}
                  </span>
                </div>
              </div>
            ))}
            {totalCount > 50 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing 50 of {totalCount} alerts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
