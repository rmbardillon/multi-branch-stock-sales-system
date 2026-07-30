"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useBranches, type Branch } from "@/hooks/use-branches";
import { useInventory, useConsolidatedView } from "@/hooks/use-inventory";
import { InventoryTable } from "@/components/data-table/inventory-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Threshold in milliseconds to consider data stale (5 minutes) */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function isDataStale(lastUpdated: string | undefined): boolean {
  if (!lastUpdated) return false;
  const now = Date.now();
  const updated = new Date(lastUpdated).getTime();
  return now - updated > STALE_THRESHOLD_MS;
}

export default function InventoryPage() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "Admin";

  // For Admin, allow branch selection. For others, use assigned branch.
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    isAdmin ? null : user?.assignedBranchId ?? null
  );

  // For consolidated view
  const [consolidatedItemId, setConsolidatedItemId] = useState<string | null>(
    null
  );
  const [consolidatedSearch, setConsolidatedSearch] = useState("");

  const { data: branches } = useBranches({ status: "Active" });

  const activeBranchId = isAdmin ? selectedBranchId : user?.assignedBranchId;

  const {
    data: inventoryData,
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
  } = useInventory(activeBranchId);

  const { data: consolidatedData, isLoading: isConsolidatedLoading } =
    useConsolidatedView(consolidatedItemId);

  // Determine staleness from the query's dataUpdatedAt (epoch ms from TanStack Query)
  const lastUpdatedStr = dataUpdatedAt
    ? new Date(dataUpdatedAt).toISOString()
    : undefined;
  const stale = isDataStale(lastUpdatedStr);

  // Build a lookup of unique items from inventory for consolidated search
  const inventoryItems = useMemo(() => {
    if (!inventoryData) return [];
    const seen = new Set<string>();
    return inventoryData.filter((item) => {
      if (seen.has(item.stock_item_id)) return false;
      seen.add(item.stock_item_id);
      return true;
    });
  }, [inventoryData]);

  const filteredItemsForConsolidated = useMemo(() => {
    if (!consolidatedSearch) return inventoryItems.slice(0, 10);
    const q = consolidatedSearch.toLowerCase();
    return inventoryItems
      .filter(
        (item) =>
          item.stock_item.name.toLowerCase().includes(q) ||
          item.stock_item.sku.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [inventoryItems, consolidatedSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inventory Monitoring
          </h1>
          <p className="text-muted-foreground">
            View current stock levels{isAdmin ? " across branches" : " at your branch"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Branch selector for Admin */}
          {isAdmin && branches && branches.length > 0 && (
            <Select
              value={selectedBranchId ?? ""}
              onValueChange={(value) => setSelectedBranchId(value || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch: Branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stale data warning */}
      {stale && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Stock data may be stale. Last updated:{" "}
            {lastUpdatedStr ? formatTimestamp(lastUpdatedStr) : "Unknown"}
          </span>
        </div>
      )}

      {/* Last updated timestamp */}
      {dataUpdatedAt && !stale && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Last updated: {formatTimestamp(lastUpdatedStr!)}</span>
        </div>
      )}

      {/* Main inventory table */}
      {!activeBranchId && isAdmin && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Select a branch to view inventory levels.
          </CardContent>
        </Card>
      )}

      {activeBranchId && isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Loading inventory data...
          </CardContent>
        </Card>
      )}

      {activeBranchId && isError && (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            Failed to load inventory data. Please try again.
          </CardContent>
        </Card>
      )}

      {activeBranchId && !isLoading && !isError && inventoryData && (
        <InventoryTable data={inventoryData} />
      )}

      {/* Consolidated view section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consolidated Stock View</CardTitle>
          <CardDescription>
            View stock levels for a specific item across all branches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                placeholder="Search items by name or SKU..."
                value={consolidatedSearch}
                onChange={(e) => {
                  setConsolidatedSearch(e.target.value);
                  setConsolidatedItemId(null);
                }}
              />
            </div>
          </div>

          {filteredItemsForConsolidated.length > 0 && !consolidatedItemId && (
            <div className="space-y-1">
              {filteredItemsForConsolidated.map((item) => (
                <button
                  key={item.stock_item_id}
                  type="button"
                  className="w-full text-left rounded-md border p-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => setConsolidatedItemId(item.stock_item_id)}
                >
                  <span className="font-mono">{item.stock_item.sku}</span>
                  {" — "}
                  <span>{item.stock_item.name}</span>
                </button>
              ))}
            </div>
          )}

          {consolidatedItemId && isConsolidatedLoading && (
            <p className="text-sm text-muted-foreground">
              Loading consolidated data...
            </p>
          )}

          {consolidatedItemId && consolidatedData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{consolidatedData.item_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    SKU: {consolidatedData.sku} &middot; Total across all
                    branches:{" "}
                    <span className="font-semibold">
                      {consolidatedData.total_quantity}
                    </span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConsolidatedItemId(null);
                    setConsolidatedSearch("");
                  }}
                >
                  Clear
                </Button>
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Branch</th>
                      <th className="p-3 text-left font-medium">Quantity</th>
                      <th className="p-3 text-left font-medium">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(consolidatedData.branches || []).map((entry) => (
                      <tr key={entry.branch_id} className="border-b">
                        <td className="p-3">{entry.branch_name}</td>
                        <td className="p-3">
                          <Badge
                            variant={
                              entry.quantity === 0 ? "destructive" : "default"
                            }
                          >
                            {entry.quantity}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {formatTimestamp(entry.last_updated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {consolidatedItemId &&
            !isConsolidatedLoading &&
            !consolidatedData && (
              <p className="text-sm text-muted-foreground">
                No consolidated data available for this item.
              </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
