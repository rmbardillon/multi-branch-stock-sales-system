"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";

export interface StockLevelItem {
  id: string;
  branch_id: string;
  stock_item_id: string;
  quantity: number;
  last_updated: string;
  stock_item: {
    id: string;
    sku: string;
    name: string;
    category: string;
    unit_price: number;
    low_stock_threshold: number;
  };
}

export interface ConsolidatedStockEntry {
  branch_id: string;
  branch_name: string;
  quantity: number;
  last_updated: string;
}

export interface ConsolidatedStock {
  item_id: string;
  item_name: string;
  sku: string;
  total_quantity: number;
  branches: ConsolidatedStockEntry[];
}

export interface LowStockAlert {
  id: string;
  stock_item_id: string;
  item_name: string;
  sku: string;
  branch_id: string;
  branch_name: string;
  current_quantity: number;
  low_stock_threshold: number;
}

const INVENTORY_QUERY_KEY = ["inventory"];
const ALERTS_QUERY_KEY = ["inventory", "alerts"];
const CONSOLIDATED_QUERY_KEY = ["inventory", "consolidated"];

/** Refetch interval in milliseconds (60 seconds) */
const REFETCH_INTERVAL = 60 * 1000;

/**
 * Fetch stock levels for a specific branch.
 * Auto-refetches every 60 seconds.
 */
export function useInventory(branchId: string | null | undefined) {
  return useQuery<StockLevelItem[], ApiClientError>({
    queryKey: [...INVENTORY_QUERY_KEY, branchId],
    queryFn: () =>
      apiClient.get<StockLevelItem[]>(`/inventory/${branchId}`),
    enabled: !!branchId,
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Fetch consolidated cross-branch stock levels for a given stock item.
 */
export function useConsolidatedView(itemId: string | null | undefined) {
  return useQuery<ConsolidatedStock, ApiClientError>({
    queryKey: [...CONSOLIDATED_QUERY_KEY, itemId],
    queryFn: () =>
      apiClient.get<ConsolidatedStock>(`/inventory/consolidated/${itemId}`),
    enabled: !!itemId,
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Fetch low-stock alerts. Optionally scoped to a specific branch.
 * Auto-refetches every 60 seconds.
 */
export function useLowStockAlerts(branchId?: string | null) {
  return useQuery<LowStockAlert[], ApiClientError>({
    queryKey: [...ALERTS_QUERY_KEY, branchId],
    queryFn: async () => {
      const endpoint = branchId
        ? `/inventory/alerts?branchId=${branchId}`
        : "/inventory/alerts";
      const response = await apiClient.get<
        Array<{
          stock_item_id: string;
          stock_item_name: string;
          sku: string;
          category: string;
          branch_id: string;
          branch_name: string;
          quantity: number;
          low_stock_threshold: number;
        }>
      >(endpoint);
      return response.map((item) => ({
        id: `${item.stock_item_id}-${item.branch_id}`,
        stock_item_id: item.stock_item_id,
        item_name: item.stock_item_name,
        sku: item.sku,
        branch_id: item.branch_id,
        branch_name: item.branch_name,
        current_quantity: item.quantity,
        low_stock_threshold: item.low_stock_threshold,
      }));
    },
    refetchInterval: REFETCH_INTERVAL,
  });
}
