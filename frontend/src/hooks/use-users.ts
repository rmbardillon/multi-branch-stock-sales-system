"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Role } from "@/providers/auth-provider";

export interface User {
  id: string;
  username: string;
  role: Role;
  assigned_branch_id: string | null;
  is_active: boolean;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  role: Role;
  assigned_branch_id: string | null;
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  role?: Role;
  assigned_branch_id?: string | null;
  is_active?: boolean;
}

export interface AssignRoleDto {
  role: Role;
  assigned_branch_id?: string | null;
}

const USERS_QUERY_KEY = ["users"];

export function useUsers() {
  return useQuery<User[]>({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: User[] }>("/users");
      return response.data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, CreateUserDto>({
    mutationFn: async (data) => {
      const response = await apiClient.post<{ data: User }>("/users", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, { id: string; data: UpdateUserDto }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put<{ data: User }>(`/users/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, { id: string; data: AssignRoleDto }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put<{ data: User }>(`/users/${id}/role`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.patch<{ data: User }>(`/users/${id}/deactivate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, string>({
    mutationFn: async (id) => {
      const response = await apiClient.patch<{ data: User }>(`/users/${id}/reactivate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      return apiClient.delete<{ message: string }>(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}
