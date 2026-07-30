"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { useAuthContext, type AuthUser } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface LoginCredentials {
  username: string;
  password: string;
}

export function useLogin() {
  const { login } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, ApiClientError, LoginCredentials>({
    mutationFn: async (credentials: LoginCredentials) => {
      return apiClient.post<LoginResponse>('/auth/login', credentials);
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      router.push('/');
    },
  });
}

export function useLogout() {
  const { logout } = useAuthContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<void, ApiClientError>({
    mutationFn: async () => {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Even if the API call fails, we still want to clear local state
      }
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      router.push('/login');
    },
  });
}

export function useCurrentUser() {
  const { user, isAuthenticated, isLoading } = useAuthContext();

  return useQuery<AuthUser | null>({
    queryKey: ['currentUser'],
    queryFn: () => user,
    enabled: !isLoading,
    initialData: isAuthenticated ? user : null,
    staleTime: Infinity, // User data from context doesn't go stale
  });
}
