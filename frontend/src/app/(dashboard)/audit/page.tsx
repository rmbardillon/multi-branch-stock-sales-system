"use client";

import React, { useState, useCallback } from "react";
import { Shield, FileText, AlertCircle } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useBranches } from "@/hooks/use-branches";
import { useAuditTrail, type AuditFilters } from "@/hooks/use-audit";
import { AuditTable } from "@/components/data-table/audit-table";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ACTION_TYPES = [
  { value: "stock_adjustment", label: "Stock Adjustment" },
  { value: "sale_created", label: "Sale Created" },
  { value: "transfer_initiated", label: "Transfer Initiated" },
  { value: "transfer_confirmed", label: "Transfer Confirmed" },
  { value: "transfer_failed", label: "Transfer Failed" },
  { value: "user_created", label: "User Created" },
  { value: "user_updated", label: "User Updated" },
  { value: "branch_created", label: "Branch Created" },
  { value: "branch_updated", label: "Branch Updated" },
  { value: "branch_deactivated", label: "Branch Deactivated" },
];

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

export default function AuditPage() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "Admin";

  const { data: branches = [] } = useBranches({ status: "Active" });

  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [branchId, setBranchId] = useState<string>("all");
  const [actionType, setActionType] = useState<string>("all");
  const [userId, setUserId] = useState("");

  const [activeFilters, setActiveFilters] = useState<AuditFilters | null>({
    startDate: defaults.startDate,
    endDate: defaults.endDate,
    pageSize: 50,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const auditQuery = useAuditTrail(
    activeFilters
      ? { ...activeFilters, page: currentPage }
      : null
  );

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    setActiveFilters({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      branchId: branchId === "all" ? undefined : branchId,
      actionType: actionType === "all" ? undefined : actionType,
      userId: userId.trim() || undefined,
      pageSize: 50,
    });
  }, [startDate, endDate, branchId, actionType, userId]);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  // Non-admin users should not access this page
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">Access Denied</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin access is required to view the audit trail.
        </p>
      </div>
    );
  }

  const showEmptyMessage =
    activeFilters &&
    !auditQuery.isLoading &&
    auditQuery.data?.data?.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Trail</h2>
        <p className="text-muted-foreground">
          View and filter all system activity records
        </p>
      </div>

      {/* Filter Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>
            Filter audit records by date range, user, branch, or action type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="audit-start-date">Start Date</Label>
              <Input
                id="audit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="audit-end-date">End Date</Label>
              <Input
                id="audit-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Branch Filter */}
            <div className="space-y-2">
              <Label htmlFor="audit-branch">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="audit-branch">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="audit-action-type">Action Type</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger id="audit-action-type">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User ID Filter */}
            <div className="space-y-2">
              <Label htmlFor="audit-user-id">User ID</Label>
              <Input
                id="audit-user-id"
                placeholder="Filter by user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="mt-4">
            <Button onClick={handleSearch} disabled={auditQuery.isLoading}>
              <FileText className="mr-2 h-4 w-4" />
              {auditQuery.isLoading ? "Searching..." : "Search Audit Trail"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {showEmptyMessage && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No audit records found for the selected filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Query Error */}
      {auditQuery.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {auditQuery.error.message || "Failed to load audit records. Please try again."}
          </span>
        </div>
      )}

      {/* Audit Table */}
      {activeFilters &&
        !auditQuery.isLoading &&
        (auditQuery.data?.data?.length ?? 0) > 0 && (
          <AuditTable
            data={auditQuery.data!.data}
            total={auditQuery.data!.total}
            page={auditQuery.data!.page}
            pageSize={auditQuery.data!.pageSize}
            onPageChange={handlePageChange}
          />
        )}

      {/* Loading state */}
      {auditQuery.isLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">Loading audit records...</div>
        </div>
      )}
    </div>
  );
}
