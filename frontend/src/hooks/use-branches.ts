"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Branch {
  id: string;
  name: string;
  address: string;
  contact_number: string;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
}

export interface CreateBranchDto {
  name: string;
  address: string;
  contact_number: string;
  status: "Active" | "Inactive";
}

export interface UpdateBranchDto {
  name?: string;
  address?: string;
  contact_number?: string;
  status?: "Active" | "Inactive";
}

export interface BranchFilters {
  status?: "Active" | "Inactive";
  search?: string;
}

const BRANCHES_QUERY_KEY = ["branches"];

export function useBranches(filters?: BranchFilters) {
  return useQuery<Branch[]>({
    queryKey: [...BRANCHES_QUERY_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.search) params.append("search", filters.search);
      const query = params.toString();
      const endpoint = query ? `/branches?${query}` : "/branches";
      const response = await apiClient.get<{ data: Branch[] }>(endpoint);
      return response.data;
    },
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation<Branch, Error, CreateBranchDto>({
    mutationFn: async (data) => {
      const response = await apiClient.post<{ data: Branch }>("/branches", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation<Branch, Error, { id: string; data: UpdateBranchDto }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put<{ data: Branch }>(`/branches/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
    },
  });
}

export function useDeactivateBranch() {
  const queryClient = useQueryClient();

  return useMutation<Branch, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.patch<{ data: Branch }>(`/branches/${id}`, {
        status: "Inactive",
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
    },
  });
}
