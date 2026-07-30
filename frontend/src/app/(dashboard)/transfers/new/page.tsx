"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, CheckCircle } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useBranches, type Branch } from "@/hooks/use-branches";
import { useSearchStockItems, type StockItem } from "@/hooks/use-stock-items";
import { useInventory } from "@/hooks/use-inventory";
import { useInitiateTransfer } from "@/hooks/use-transfers";
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

export default function NewTransferPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [sourceBranchId, setSourceBranchId] = useState<string>(
    user?.assignedBranchId || ""
  );
  const [destinationBranchId, setDestinationBranchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: branches } = useBranches({ status: "Active" });
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: isSearching } =
    useSearchStockItems(debouncedSearch);
  const { data: inventoryData } = useInventory(sourceBranchId || undefined);
  const initiateTransfer = useInitiateTransfer();

  // For non-Admin users, lock the source branch to their assigned branch
  const isSourceLocked = user?.role !== "Admin";

  // Available destination branches (exclude source)
  const destinationBranches =
    branches?.filter((b) => b.id !== sourceBranchId) ?? [];

  // Get available stock for a given item at the source branch
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

  function handleAddItem(item: StockItem) {
    // Don't add duplicates
    if (lineItems.some((li) => li.stock_item_id === item.id)) return;
    // Max 50 items
    if (lineItems.length >= 50) return;

    const available = getAvailableQuantity(item.id);
    setLineItems((prev) => [
      ...prev,
      {
        stock_item_id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: 1,
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
    if (quantity < 1 || quantity > 10000) return;
    setLineItems((prev) =>
      prev.map((li) =>
        li.stock_item_id === stockItemId ? { ...li, quantity } : li
      )
    );
  }

  async function handleSubmit() {
    if (!sourceBranchId || !destinationBranchId || lineItems.length === 0)
      return;

    setApiError(null);

    try {
      await initiateTransfer.mutateAsync({
        source_branch_id: sourceBranchId,
        destination_branch_id: destinationBranchId,
        line_items: lineItems.map((li) => ({
          stock_item_id: li.stock_item_id,
          quantity: li.quantity,
        })),
      });
      setShowSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setApiError((err as { message: string }).message);
      } else {
        setApiError("Failed to initiate transfer");
      }
    }
  }

  function handleSuccessClose() {
    setShowSuccess(false);
    router.push("/transfers");
  }

  const canSubmit =
    sourceBranchId &&
    destinationBranchId &&
    lineItems.length > 0 &&
    lineItems.length <= 50 &&
    lineItems.every((li) => li.quantity >= 1 && li.quantity <= 10000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Transfer</h1>
        <p className="text-muted-foreground">
          Initiate a stock transfer between branches.
        </p>
      </div>

      {/* Branch selection */}
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div className="space-y-2">
          <Label>Source Branch</Label>
          {isSourceLocked ? (
            <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
              {branches?.find((b) => b.id === sourceBranchId)?.name ||
                "Your branch"}
            </div>
          ) : (
            <Select value={sourceBranchId} onValueChange={setSourceBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label>Destination Branch</Label>
          <Select
            value={destinationBranchId}
            onValueChange={setDestinationBranchId}
            disabled={!sourceBranchId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select destination branch" />
            </SelectTrigger>
            <SelectContent>
              {destinationBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stock item search */}
      <div className="space-y-2">
        <Label>
          Search Stock Items{" "}
          <span className="text-muted-foreground font-normal">
            ({lineItems.length}/50 items)
          </span>
        </Label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by SKU, name, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={lineItems.length >= 50}
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
                          SKU: {item.sku} &middot; Available: {available}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddItem(item)}
                        disabled={alreadyAdded || lineItems.length >= 50}
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
                <TableHead className="w-32">Quantity (1-10000)</TableHead>
                <TableHead>Available at Source</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((li) => {
                const exceedsStock = li.quantity > li.available_quantity;
                const invalidQty = li.quantity < 1 || li.quantity > 10000;
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
                        max={10000}
                        value={li.quantity}
                        onChange={(e) =>
                          handleQuantityChange(
                            li.stock_item_id,
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                        className={`w-24 ${exceedsStock || invalidQty ? "border-destructive" : ""}`}
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

      {/* Submit */}
      {lineItems.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 p-4">
          <div className="text-sm text-muted-foreground">
            {lineItems.length} item{lineItems.length !== 1 ? "s" : ""} to
            transfer
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || initiateTransfer.isPending}
          >
            {initiateTransfer.isPending
              ? "Submitting..."
              : "Initiate Transfer"}
          </Button>
        </div>
      )}

      {/* API error */}
      {apiError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {apiError}
        </div>
      )}

      {/* Empty state */}
      {lineItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            Select branches and search for stock items to add to this transfer.
          </p>
        </div>
      )}

      {/* Success dialog */}
      <Dialog open={showSuccess} onOpenChange={() => handleSuccessClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Transfer Initiated
            </DialogTitle>
            <DialogDescription>
              Your stock transfer has been successfully created and is pending
              confirmation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleSuccessClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
