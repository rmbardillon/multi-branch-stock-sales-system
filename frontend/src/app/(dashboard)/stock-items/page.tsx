"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockItemsTable } from "@/components/data-table/stock-items-table";
import { StockItemFormDialog } from "@/components/forms/stock-item-form";
import {
  useStockItems,
  useSearchStockItems,
  type StockItem,
} from "@/hooks/use-stock-items";
import { useAuthContext } from "@/providers/auth-provider";

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

export default function StockItemsPage() {
  const { user } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    data: allItems,
    isLoading: isLoadingAll,
    error: allItemsError,
  } = useStockItems();

  const {
    data: searchResults,
    isLoading: isSearching,
  } = useSearchStockItems(debouncedSearch);

  // Determine which data to display
  const displayData = debouncedSearch.length > 0 ? searchResults : allItems;
  const isLoading = debouncedSearch.length > 0 ? isSearching : isLoadingAll;

  // Permission check: Admin and Branch_Manager have stock_item:write
  const canWrite =
    user?.role === "Admin" || user?.role === "Branch_Manager";

  const handleEdit = useCallback((item: StockItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingItem(null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingItem(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Items</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and stock item details.
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Stock Item
          </Button>
        )}
      </div>

      {/* Search input */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by SKU, name, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error state */}
      {allItemsError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load stock items: {allItemsError.message}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading stock items...
        </div>
      )}

      {/* Data table */}
      {!isLoading && displayData && (
        <StockItemsTable
          data={displayData}
          onEdit={handleEdit}
          canWrite={canWrite}
        />
      )}

      {/* Create/Edit Dialog */}
      <StockItemFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        stockItem={editingItem}
      />
    </div>
  );
}
