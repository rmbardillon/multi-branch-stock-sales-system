"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";

export interface SalesReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  category?: string;
}

export interface SalesReportItem {
  item_name: string;
  sku: string;
  category: string;
  total_quantity_sold: number;
  total_revenue: number;
}

export interface SalesReportData {
  data: SalesReportItem[];
  total_revenue: number;
  total_quantity: number;
}

export interface StockReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

export interface StockReportItem {
  stock_item_id: string;
  item_name: string;
  sku: string;
  category: string;
  current_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  branch_id: string;
  branch_name: string;
  recent_sales_quantity: number;
  recent_transfers_in: number;
  recent_transfers_out: number;
}

export interface StockReportData {
  data: StockReportItem[];
  total_items: number;
  low_stock_count: number;
}

const REPORTS_QUERY_KEY = ["reports"];

/**
 * Fetch sales report with optional filters (date range, branch, category).
 * GET /api/reports/sales
 */
export function useSalesReport(filters?: SalesReportFilters | null) {
  return useQuery<SalesReportData, ApiClientError>({
    queryKey: [...REPORTS_QUERY_KEY, "sales", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.branchId) params.append("branchId", filters.branchId);
      if (filters?.category) params.append("category", filters.category);
      const query = params.toString();
      const endpoint = query ? `/reports/sales?${query}` : "/reports/sales";
      const response = await apiClient.get<{ data: SalesReportItem[]; message?: string }>(endpoint);
      const items = response.data || [];
      return {
        data: items,
        total_revenue: items.reduce((sum, i) => sum + (i.total_revenue || 0), 0),
        total_quantity: items.reduce((sum, i) => sum + (i.total_quantity_sold || 0), 0),
      };
    },
    enabled: !!filters?.startDate && !!filters?.endDate,
  });
}

/**
 * Fetch stock report with optional filters (date range, branch).
 * GET /api/reports/stock
 */
export function useStockReport(filters?: StockReportFilters | null) {
  return useQuery<StockReportData, ApiClientError>({
    queryKey: [...REPORTS_QUERY_KEY, "stock", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.branchId) params.append("branchId", filters.branchId);
      const query = params.toString();
      const endpoint = query ? `/reports/stock?${query}` : "/reports/stock";
      const response = await apiClient.get<{ data: StockReportItem[]; message?: string }>(endpoint);
      const items = response.data || [];
      return {
        data: items,
        total_items: items.length,
        low_stock_count: items.filter((i) => i.is_low_stock).length,
      };
    },
    enabled: !!filters,
  });
}

/**
 * Export report data as CSV. Performs a direct fetch for blob response.
 * GET /api/reports/export
 */
export async function exportReportCsv(params: {
  type: "sales" | "stock";
  startDate?: string;
  endDate?: string;
  branchId?: string;
  category?: string;
}): Promise<Blob> {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("auth_token")
      : null;

  const searchParams = new URLSearchParams();
  searchParams.append("type", params.type);
  if (params.startDate) searchParams.append("startDate", params.startDate);
  if (params.endDate) searchParams.append("endDate", params.endDate);
  if (params.branchId) searchParams.append("branchId", params.branchId);
  if (params.category) searchParams.append("category", params.category);

  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}/reports/export?${searchParams.toString()}`,
    { method: "GET", headers }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Export failed");
    throw new Error(errorText || "Failed to export report");
  }

  return response.blob();
}
