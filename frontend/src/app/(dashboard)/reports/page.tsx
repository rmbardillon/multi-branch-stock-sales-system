"use client";

import React, { useState, useCallback } from "react";
import { Download, FileText, AlertCircle } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useBranches } from "@/hooks/use-branches";
import {
  useSalesReport,
  useStockReport,
  exportReportCsv,
  type SalesReportFilters,
  type StockReportFilters,
} from "@/hooks/use-reports";
import { SalesReportTable } from "@/components/data-table/sales-report-table";
import { StockReportTable } from "@/components/data-table/stock-report-table";
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

type ReportType = "sales" | "stock";

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

function validateDateRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return "Start date and end date are required.";
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return "Invalid date format.";
  if (end < start) return "End date must be after start date.";
  const diffDays =
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 365) return "Date range cannot exceed 365 days.";
  return null;
}

export default function ReportsPage() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "Admin";

  const { data: branches = [] } = useBranches({ status: "Active" });

  const defaults = getDefaultDateRange();
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [branchId, setBranchId] = useState<string>("all");
  const [category, setCategory] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Active filters represent the last "Generate Report" click
  const [activeSalesFilters, setActiveSalesFilters] =
    useState<SalesReportFilters | null>(null);
  const [activeStockFilters, setActiveStockFilters] =
    useState<StockReportFilters | null>(null);

  const salesReport = useSalesReport(
    reportType === "sales" ? activeSalesFilters : null
  );
  const stockReport = useStockReport(
    reportType === "stock" ? activeStockFilters : null
  );

  const handleGenerateReport = useCallback(() => {
    setExportError(null);
    const error = validateDateRange(startDate, endDate);
    if (error) {
      setDateError(error);
      return;
    }
    setDateError(null);

    const effectiveBranchId = branchId === "all" ? undefined : branchId;

    if (reportType === "sales") {
      setActiveSalesFilters({
        startDate,
        endDate,
        branchId: effectiveBranchId,
        category: category || undefined,
      });
      setActiveStockFilters(null);
    } else {
      setActiveStockFilters({
        branchId: effectiveBranchId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setActiveSalesFilters(null);
    }
  }, [reportType, startDate, endDate, branchId, category]);

  const handleExportCsv = useCallback(async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const effectiveExportBranchId = branchId === "all" ? undefined : branchId;
      const blob = await exportReportCsv({
        type: reportType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        branchId: effectiveExportBranchId,
        category: reportType === "sales" ? category || undefined : undefined,
      });

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportType}-report-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError("Export could not be completed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [reportType, startDate, endDate, branchId, category]);

  const isLoading = salesReport.isLoading || stockReport.isLoading;
  const hasData =
    reportType === "sales"
      ? (salesReport.data?.data?.length ?? 0) > 0
      : (stockReport.data?.data?.length ?? 0) > 0;
  const showEmptyMessage =
    reportType === "sales"
      ? activeSalesFilters &&
        !salesReport.isLoading &&
        salesReport.data?.data?.length === 0
      : activeStockFilters &&
        !stockReport.isLoading &&
        stockReport.data?.data?.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Generate sales and stock reports with customizable filters
        </p>
      </div>

      {/* Filter Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Filters</CardTitle>
          <CardDescription>
            Select report type and apply filters to generate your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Report Type */}
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as ReportType)}
              >
                <SelectTrigger id="report-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Report</SelectItem>
                  <SelectItem value="stock">Stock Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateError(null);
                }}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateError(null);
                }}
              />
            </div>

            {/* Branch (Admin only) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="branch-filter">Branch</Label>
                <Select
                  value={branchId}
                  onValueChange={setBranchId}
                >
                  <SelectTrigger id="branch-filter">
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
            )}

            {/* Category (Sales only) */}
            {reportType === "sales" && (
              <div className="space-y-2">
                <Label htmlFor="category-filter">Category</Label>
                <Input
                  id="category-filter"
                  placeholder="All categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Date validation error */}
          {dateError && (
            <p className="mt-3 text-sm text-destructive">{dateError}</p>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleGenerateReport} disabled={isLoading}>
              <FileText className="mr-2 h-4 w-4" />
              {isLoading ? "Generating..." : "Generate Report"}
            </Button>

            {hasData && (
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Error Toast/Alert */}
      {exportError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{exportError}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-auto p-1 text-destructive hover:text-destructive"
            onClick={() => setExportError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Query Error */}
      {(salesReport.error || stockReport.error) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {salesReport.error?.message ||
              stockReport.error?.message ||
              "Failed to generate report. Please try again."}
          </span>
        </div>
      )}

      {/* Empty State */}
      {showEmptyMessage && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No data available for the selected filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sales Report Table */}
      {reportType === "sales" &&
        activeSalesFilters &&
        !salesReport.isLoading &&
        (salesReport.data?.data?.length ?? 0) > 0 && (
          <SalesReportTable data={salesReport.data!.data} />
        )}

      {/* Stock Report Table */}
      {reportType === "stock" &&
        activeStockFilters &&
        !stockReport.isLoading &&
        (stockReport.data?.data?.length ?? 0) > 0 && (
          <StockReportTable data={stockReport.data!.data} />
        )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">Generating report...</div>
        </div>
      )}
    </div>
  );
}
