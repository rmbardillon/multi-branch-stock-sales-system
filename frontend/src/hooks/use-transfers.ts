"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";

export type TransferStatus = "pending" | "confirmed" | "failed";

export interface TransferLineItem {
  id: string;
  stock_transfer_id: string;
  stock_item_id: string;
  quantity: number;
  stock_item_name?: string;
  stock_item_sku?: string;
}

export interface StockTransfer {
  id: string;
  source_branch_id: string;
  destination_branch_id: string;
  initiated_by: string;
  status: TransferStatus;
  created_at: string;
  confirmed_at: string | null;
  line_items: TransferLineItem[];
  source_branch_name?: string;
  destination_branch_name?: string;
}

export interface CreateTransferLineItemInput {
  stock_item_id: string;
  quantity: number;
}

export interface CreateTransferInput {
  source_branch_id: string;
  destination_branch_id: string;
  line_items: CreateTransferLineItemInput[];
}

export interface TransferFilters {
  status?: TransferStatus;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTransfersResponse {
  transfers: StockTransfer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TRANSFERS_QUERY_KEY = ["transfers"];

/**
 * Fetch stock transfers for a specific branch with optional filters.
 */
export function useTransfers(
  branchId: string | null | undefined,
  filters?: TransferFilters
) {
  return useQuery<PaginatedTransfersResponse, ApiClientError>({
    queryKey: [...TRANSFERS_QUERY_KEY, branchId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.pageSize)
        params.append("pageSize", String(filters.pageSize));
      const query = params.toString();
      const endpoint = query
        ? `/transfers/${branchId}?${query}`
        : `/transfers/${branchId}`;
      return apiClient.get<PaginatedTransfersResponse>(endpoint);
    },
    enabled: !!branchId,
  });
}

/**
 * Initiate a new stock transfer. Invalidates transfers and inventory queries on success.
 */
export function useInitiateTransfer() {
  const queryClient = useQueryClient();

  return useMutation<StockTransfer, ApiClientError, CreateTransferInput>({
    mutationFn: (data) =>
      apiClient.post<StockTransfer>("/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/**
 * Confirm a pending stock transfer. Invalidates transfers and inventory queries on success.
 */
export function useConfirmTransfer() {
  const queryClient = useQueryClient();

  return useMutation<StockTransfer, ApiClientError, string>({
    mutationFn: (transferId) =>
      apiClient.post<StockTransfer>(`/transfers/${transferId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
