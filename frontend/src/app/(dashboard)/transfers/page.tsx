"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import {
  useTransfers,
  useConfirmTransfer,
  type TransferFilters,
  type TransferStatus,
} from "@/hooks/use-transfers";
import { TransfersTable } from "@/components/data-table/transfers-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TransfersPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const canInitiate =
    user?.role === "Admin" || user?.role === "Branch_Manager";

  const branchId = user?.assignedBranchId;

  const [filters, setFilters] = useState<TransferFilters>({
    page: 1,
    pageSize: 10,
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: transfersResponse, isLoading, error } = useTransfers(
    branchId,
    filters
  );
  const confirmTransfer = useConfirmTransfer();

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    setFilters((prev) => ({
      ...prev,
      status: value === "all" ? undefined : (value as TransferStatus),
      page: 1,
    }));
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleConfirm(transferId: string) {
    confirmTransfer.mutate(transferId);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading transfers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Stock Transfers
          </h1>
          <p className="text-muted-foreground">
            View and manage stock transfers between branches.
          </p>
        </div>
        {canInitiate && (
          <Button onClick={() => router.push("/transfers/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Transfer
          </Button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load transfers: {error.message}
        </div>
      )}

      {/* Confirm error */}
      {confirmTransfer.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to confirm transfer: {confirmTransfer.error.message}
        </div>
      )}

      {/* Transfers table */}
      {transfersResponse && (
        <TransfersTable
          data={transfersResponse.transfers}
          total={transfersResponse.total}
          page={transfersResponse.page}
          pageSize={transfersResponse.pageSize}
          onPageChange={handlePageChange}
          onConfirm={handleConfirm}
          isConfirming={confirmTransfer.isPending}
        />
      )}
    </div>
  );
}
