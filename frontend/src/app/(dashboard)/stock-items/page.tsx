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
  useDeactivateStockItem,
  useReactivateStockItem,
  useDeleteStockItem,
  type StockItem,
} from "@/hooks/use-stock-items";
import { useAuthContext } from "@/providers/auth-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  const deactivateItem = useDeactivateStockItem();
  const reactivateItem = useReactivateStockItem();
  const deleteItem = useDeleteStockItem();

  const [deactivatingItem, setDeactivatingItem] = useState<StockItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    data: allItems,
    isLoading: isLoadingAll,
    error: allItemsError,
  } = useStockItems(true);

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

  const handleDeactivate = useCallback((item: StockItem) => {
    setDeactivatingItem(item);
  }, []);

  const handleReactivate = useCallback((item: StockItem) => {
    reactivateItem.mutate(item.id);
  }, [reactivateItem]);

  const handleDelete = useCallback((item: StockItem) => {
    setDeleteError(null);
    setDeletingItem(item);
  }, []);

  async function handleConfirmDeactivate() {
    if (deactivatingItem) {
      await deactivateItem.mutateAsync(deactivatingItem.id);
      setDeactivatingItem(null);
    }
  }

  async function handleConfirmDelete() {
    if (deletingItem) {
      try {
        await deleteItem.mutateAsync(deletingItem.id);
        setDeletingItem(null);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          setDeleteError((err as { message: string }).message);
        } else {
          setDeleteError("Failed to delete stock item.");
        }
      }
    }
  }

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
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          onDelete={handleDelete}
          canWrite={canWrite}
        />
      )}

      {/* Create/Edit Dialog */}
      <StockItemFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        stockItem={editingItem}
      />

      {/* Deactivate confirmation */}
      <AlertDialog
        open={!!deactivatingItem}
        onOpenChange={(open) => {
          if (!open) setDeactivatingItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Stock Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-semibold">{deactivatingItem?.name}</span> ({deactivatingItem?.sku})?
              It will no longer appear in POS, sales, or inventory views.
              You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateItem.isPending ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Item Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{deletingItem?.name}</span> ({deletingItem?.sku}).
              This action cannot be undone. If this item has any sales or
              transfer history, deletion will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItem.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
