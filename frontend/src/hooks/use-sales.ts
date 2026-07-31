"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";

export interface SaleLineItem {
  id: string;
  sale_transaction_id: string;
  stock_item_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  stock_item_name?: string;
  stock_item_sku?: string;
}

export interface SaleTransaction {
  id: string;
  reference_number: string;
  branch_id: string;
  created_by: string;
  total_amount: number;
  transaction_date: string;
  created_at: string;
  line_items?: SaleLineItem[];
}

export interface CreateSaleLineItemInput {
  stock_item_id: string;
  quantity: number;
  unit_price: number;
}

export interface CreateSaleInput {
  branch_id: string;
  line_items: CreateSaleLineItemInput[];
}

export interface SaleFilters {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSalesResponse {
  data: SaleTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SALES_QUERY_KEY = ["sales"];

/**
 * Fetch sales transactions for a specific branch with optional date range and pagination.
 * If branchId is null/undefined, fetches across all branches (Admin only).
 */
export function useSales(
  branchId: string | null | undefined,
  filters?: SaleFilters
) {
  return useQuery<PaginatedSalesResponse, ApiClientError>({
    queryKey: [...SALES_QUERY_KEY, branchId ?? "all", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.pageSize)
        params.append("pageSize", String(filters.pageSize));
      const query = params.toString();
      const basePath = branchId ? `/sales/${branchId}` : `/sales`;
      const endpoint = query ? `${basePath}?${query}` : basePath;
      const response = await apiClient.get<{
        transactions: SaleTransaction[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(endpoint);
      return {
        data: response.transactions,
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
        totalPages: response.totalPages,
      };
    },
  });
}

/**
 * Create a new sale transaction. Invalidates sales and inventory queries on success.
 */
export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation<SaleTransaction, ApiClientError, CreateSaleInput>({
    mutationFn: (data) => apiClient.post<SaleTransaction>("/sales", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
