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

export function useStockItems() {
  return useQuery<StockItem[], ApiClientError>({
    queryKey: ["stock-items"],
    queryFn: () => apiClient.get<StockItem[]>("/stock-items"),
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
