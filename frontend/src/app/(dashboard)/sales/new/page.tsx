"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, CheckCircle } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useSearchStockItems, type StockItem } from "@/hooks/use-stock-items";
import { useInventory } from "@/hooks/use-inventory";
import { useBranches } from "@/hooks/use-branches";
import { useCreateSale } from "@/hooks/use-sales";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LineItem {
  stock_item_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  available_quantity: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function NewSalePage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isAdmin = user?.role === "Admin";

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const branchId = isAdmin ? selectedBranchId : user?.assignedBranchId;

  // Fetch branches for Admin's branch selector
  const { data: branches } = useBranches({ status: "Active" });

  const [searchQuery, setSearchQuery] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [insufficientItems, setInsufficientItems] = useState<
    { name: string; requested: number; available: number }[]
  >([]);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: isSearching } =
    useSearchStockItems(debouncedSearch);
  const { data: inventoryData, isLoading: isInventoryLoading } = useInventory(branchId);
  const createSale = useCreateSale();

  // Get available stock for a given item at the user's branch
  const getAvailableQuantity = useCallback(
    (stockItemId: string): number => {
      if (!inventoryData) return 0;
      const stockLevel = inventoryData.find(
        (sl) => sl.stock_item_id === stockItemId
      );
      return stockLevel?.quantity ?? 0;
    },
    [inventoryData]
  );

  // Keep line items' available_quantity in sync when inventoryData loads/updates
  useEffect(() => {
    if (!inventoryData || lineItems.length === 0) return;
    setLineItems((prev) =>
      prev.map((li) => {
        const stockLevel = inventoryData.find(
          (sl) => sl.stock_item_id === li.stock_item_id
        );
        const freshAvailable = stockLevel?.quantity ?? 0;
        if (freshAvailable !== li.available_quantity) {
          return { ...li, available_quantity: freshAvailable };
        }
        return li;
      })
    );
  }, [inventoryData]);

  function handleAddItem(item: StockItem) {
    // Don't add duplicates
    if (lineItems.some((li) => li.stock_item_id === item.id)) return;

    const available = getAvailableQuantity(item.id);
    setLineItems((prev) => [
      ...prev,
      {
        stock_item_id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: 1,
        unit_price: item.unit_price,
        available_quantity: available,
      },
    ]);
    setSearchQuery("");
  }

  function handleRemoveItem(stockItemId: string) {
    setLineItems((prev) =>
      prev.filter((li) => li.stock_item_id !== stockItemId)
    );
  }

  function handleQuantityChange(stockItemId: string, quantity: number) {
    if (quantity < 1) return;
    setLineItems((prev) =>
      prev.map((li) =>
        li.stock_item_id === stockItemId ? { ...li, quantity } : li
      )
    );
  }

  const runningTotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price,
    0
  );

  async function handleSubmit() {
    if (!branchId || lineItems.length === 0) return;

    setInsufficientItems([]);

    try {
      const result = await createSale.mutateAsync({
        branch_id: branchId,
        line_items: lineItems.map((li) => ({
          stock_item_id: li.stock_item_id,
          quantity: li.quantity,
          unit_price: Number(li.unit_price),
        })),
      });
      setSuccessRef(result.reference_number);
    } catch (err: unknown) {
      // Check for insufficient stock error (422)
      if (
        err &&
        typeof err === "object" &&
        "statusCode" in err &&
        (err as { statusCode: number }).statusCode === 422
      ) {
        const apiErr = err as { message: string; details?: Record<string, string[]> };
        // Try to parse insufficient stock details from error
        if (apiErr.details) {
          const items = Object.entries(apiErr.details).map(
            ([itemName, messages]) => {
              const msg = messages[0] || "";
              const availableMatch = msg.match(/available:\s*(\d+)/i);
              const requestedMatch = msg.match(/requested:\s*(\d+)/i);
              return {
                name: itemName,
                requested: requestedMatch ? parseInt(requestedMatch[1], 10) : 0,
                available: availableMatch ? parseInt(availableMatch[1], 10) : 0,
              };
            }
          );
          setInsufficientItems(items);
        } else {
          setInsufficientItems([
            {
              name: "Unknown",
              requested: 0,
              available: 0,
            },
          ]);
        }
      }
    }
  }

  function handleSuccessClose() {
    setSuccessRef(null);
    router.push("/sales");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Sale</h1>
        <p className="text-muted-foreground">
          Create a new sales transaction.
        </p>
      </div>

      {/* Branch selector for Admin users */}
      {isAdmin && (
        <div className="space-y-2 max-w-md">
          <Label>Branch</Label>
          <Select
            value={selectedBranchId}
            onValueChange={(value) => {
              setSelectedBranchId(value);
              setLineItems([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches?.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stock item search */}
      <div className="space-y-2">
        <Label>Search Stock Items</Label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by SKU, name, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Search results dropdown */}
        {debouncedSearch.length > 0 && searchResults && (
          <div className="max-w-md rounded-md border bg-background shadow-md">
            {isSearching ? (
              <div className="p-3 text-sm text-muted-foreground">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                No items found.
              </div>
            ) : (
              <ul className="max-h-60 overflow-auto">
                {searchResults.map((item) => {
                  const alreadyAdded = lineItems.some(
                    (li) => li.stock_item_id === item.id
                  );
                  const available = getAvailableQuantity(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                    >
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          SKU: {item.sku} &middot; ${Number(item.unit_price).toFixed(2)}{" "}
                          &middot; Available: {isInventoryLoading ? "..." : available}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddItem(item)}
                        disabled={alreadyAdded}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Line items table */}
      {lineItems.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="w-28">Quantity</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Line Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((li) => {
                const lineTotal = li.quantity * li.unit_price;
                const exceedsStock = li.quantity > li.available_quantity;
                return (
                  <TableRow key={li.stock_item_id}>
                    <TableCell className="font-medium">{li.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {li.sku}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={li.quantity}
                        onChange={(e) =>
                          handleQuantityChange(
                            li.stock_item_id,
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                        className={`w-20 ${exceedsStock ? "border-destructive" : ""}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          exceedsStock
                            ? "text-destructive font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {li.available_quantity}
                      </span>
                    </TableCell>
                    <TableCell>${Number(li.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="font-medium">
                      ${lineTotal.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(li.stock_item_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Running total and submit */}
      {lineItems.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4">
          <div className="text-lg font-semibold">
            Total:{" "}
            <span className="text-primary">
              {formatCurrency(runningTotal)}
            </span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={createSale.isPending || lineItems.length === 0}
          >
            {createSale.isPending ? "Processing..." : "Complete Sale"}
          </Button>
        </div>
      )}

      {/* Insufficient stock error */}
      {insufficientItems.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">
            Insufficient stock for the following items:
          </p>
          <ul className="space-y-1 text-sm text-destructive">
            {insufficientItems.map((item, i) => (
              <li key={i}>
                <span className="font-medium">{item.name}</span>
                {item.requested > 0 && (
                  <span>
                    {" "}
                    — Requested: {item.requested}, Available: {item.available}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {lineItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            Search and add stock items to create a sale.
          </p>
        </div>
      )}

      {/* Success dialog */}
      <Dialog open={!!successRef} onOpenChange={() => handleSuccessClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Sale Completed
            </DialogTitle>
            <DialogDescription>
              Your sale has been successfully processed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Transaction Reference
            </p>
            <p className="mt-1 text-lg font-mono font-bold">{successRef}</p>
          </div>
          <DialogFooter>
            <Button onClick={handleSuccessClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
