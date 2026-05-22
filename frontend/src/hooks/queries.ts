import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";

const isAuthed = () => !!useAuthStore.getState().token;

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.getDashboard,
    enabled: isAuthed(),
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: api.getWatchlist,
    enabled: isAuthed(),
  });
}

export function useWatchlistMutations() {
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (symbol: string) => api.addToWatchlist(symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.removeFromWatchlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });
  return { add, remove };
}

export function useCopilotChat() {
  return useMutation({
    mutationFn: (message: string) => api.copilotChat(message),
  });
}

export function useAuthActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (token, { email }) => {
      setAuth(token.access_token, email);
      queryClient.clear();
      router.push("/screener");
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName?: string;
    }) => api.register({ email, password, full_name: fullName }),
    onSuccess: (_, { email, password }) => {
      loginMutation.mutate({ email, password });
    },
  });

  const logout = () => {
    clearAuth();
    queryClient.clear();
    router.push("/login");
  };

  return { loginMutation, registerMutation, logout };
}
