"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStockItemInput {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit_price: number;
  low_stock_threshold: number;
}

export interface UpdateStockItemInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit_price?: number;
  low_stock_threshold?: number;
}

export function useStockItems(includeInactive = false) {
  return useQuery<StockItem[], ApiClientError>({
    queryKey: ["stock-items", { includeInactive }],
    queryFn: () =>
      apiClient.get<StockItem[]>(
        includeInactive ? "/stock-items?includeInactive=true" : "/stock-items"
      ),
  });
}

export function useSearchStockItems(query: string) {
  return useQuery<StockItem[], ApiClientError>({
    queryKey: ["stock-items", "search", query],
    queryFn: () =>
      apiClient.get<StockItem[]>(
        `/stock-items/search?q=${encodeURIComponent(query)}`
      ),
    enabled: query.length > 0,
  });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();

  return useMutation<StockItem, ApiClientError, CreateStockItemInput>({
    mutationFn: (data) => apiClient.post<StockItem>("/stock-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();

  return useMutation<
    StockItem,
    ApiClientError,
    { id: string; data: UpdateStockItemInput }
  >({
    mutationFn: ({ id, data }) =>
      apiClient.put<StockItem>(`/stock-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useDeactivateStockItem() {
  const queryClient = useQueryClient();

  return useMutation<StockItem, ApiClientError, string>({
    mutationFn: (id) =>
      apiClient.patch<StockItem>(`/stock-items/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useReactivateStockItem() {
  const queryClient = useQueryClient();

  return useMutation<StockItem, ApiClientError, string>({
    mutationFn: (id) =>
      apiClient.patch<StockItem>(`/stock-items/${id}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, ApiClientError, string>({
    mutationFn: (id) =>
      apiClient.delete<{ message: string }>(`/stock-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

/**
 * Fetch a single stock item by exact SKU (case-insensitive).
 * Used by the POS page for barcode scanner lookups.
 * Returns null if not found.
 */
export async function fetchStockItemBySku(
  sku: string
): Promise<StockItem | null> {
  try {
    return await apiClient.get<StockItem>(
      `/stock-items/sku/${encodeURIComponent(sku)}`
    );
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}
