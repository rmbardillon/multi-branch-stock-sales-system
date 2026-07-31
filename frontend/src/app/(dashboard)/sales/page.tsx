"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useSales, type SaleFilters } from "@/hooks/use-sales";
import { useBranches } from "@/hooks/use-branches";
import { SalesTable } from "@/components/data-table/sales-table";
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

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const canCreate =
    user?.role === "Admin" ||
    user?.role === "Branch_Manager" ||
    user?.role === "Sales_Staff";

  const isAdmin = user?.role === "Admin";
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const branchId = isAdmin ? selectedBranchId : user?.assignedBranchId;

  const { data: branches } = useBranches({ status: "Active" });

  const [filters, setFilters] = useState<SaleFilters>({
    page: 1,
    pageSize: 10,
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: salesResponse, isLoading, error } = useSales(branchId, filters);

  function handleFilter() {
    setFilters((prev) => ({
      ...prev,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
    }));
  }

  function handleClearFilters() {
    setStartDate("");
    setEndDate("");
    setFilters({ page: 1, pageSize: 10 });
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading sales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground">
            View and manage sales transactions.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/sales/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Sale
          </Button>
        )}
      </div>

      {/* Branch selector for Admin */}
      {isAdmin && (
        <div className="space-y-2 max-w-md">
          <Label>Branch</Label>
          <Select
            value={selectedBranchId}
            onValueChange={(value) => {
              setSelectedBranchId(value);
              setFilters({ page: 1, pageSize: 10 });
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

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={handleFilter} variant="secondary">
          Apply Filter
        </Button>
        {(filters.startDate || filters.endDate) && (
          <Button onClick={handleClearFilters} variant="ghost">
            Clear
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load sales: {error.message}
        </div>
      )}

      {/* Sales table */}
      {salesResponse && (
        <SalesTable
          data={salesResponse.data}
          total={salesResponse.total}
          page={salesResponse.page}
          pageSize={salesResponse.pageSize}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
