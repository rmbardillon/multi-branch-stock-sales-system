"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";

export interface AuditRecord {
  id: string;
  user_id: string;
  branch_id: string;
  action_type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  branchId?: string;
  actionType?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryResponse {
  data: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
}

const AUDIT_QUERY_KEY = ["audit"];

/**
 * Fetch audit trail records with optional filters and pagination.
 * GET /api/audit
 * Admin-only endpoint.
 */
export function useAuditTrail(filters?: AuditFilters | null) {
  return useQuery<AuditQueryResponse, ApiClientError>({
    queryKey: [...AUDIT_QUERY_KEY, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.userId) params.append("userId", filters.userId);
      if (filters?.branchId) params.append("branchId", filters.branchId);
      if (filters?.actionType) params.append("actionType", filters.actionType);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.pageSize) params.append("pageSize", String(filters.pageSize));
      const query = params.toString();
      const endpoint = query ? `/audit?${query}` : "/audit";
      return apiClient.get<AuditQueryResponse>(endpoint);
    },
    enabled: !!filters,
  });
}
