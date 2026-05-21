import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type { ScreenerCriteria } from "@/lib/types";

const isAuthed = () => !!useAuthStore.getState().token;

// ——— Queries ———

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

export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies,
    queryFn: api.getStrategies,
    enabled: isAuthed(),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: api.getSubscription,
    enabled: isAuthed(),
  });
}

export function usePaperBalance() {
  return useQuery({
    queryKey: queryKeys.paperBalance,
    queryFn: api.getPaperBalance,
    enabled: isAuthed(),
  });
}

export function useMarketplace(skip = 0, limit = 20) {
  return useQuery({
    queryKey: queryKeys.marketplace(skip, limit),
    queryFn: () => api.getMarketplace(skip, limit),
  });
}

export function useAISuggestion(
  symbol: string | undefined,
  risk = "medium",
  style = "swing"
) {
  return useQuery({
    queryKey: queryKeys.aiSuggestion(symbol ?? "", risk, style),
    queryFn: () =>
      api.getAISuggestion({ symbol: symbol!, risk_level: risk, trading_style: style }),
    enabled: isAuthed() && !!symbol,
  });
}

// ——— Auth mutations ———

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
      router.push("/dashboard");
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

// ——— Watchlist mutations ———

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
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  return { add, remove };
}

// ——— Strategy mutations ———

export function useStrategyMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: api.createStrategy,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteStrategy(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, activate }: { id: number; activate: boolean }) =>
      api.toggleStrategy(id, activate),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies }),
  });

  return { create, remove, toggle };
}

// ——— Other mutations ———

export function useCopilotChat() {
  return useMutation({
    mutationFn: (message: string) => api.copilotChat(message),
  });
}

export function useScreener() {
  return useMutation({
    mutationFn: (criteria: ScreenerCriteria) => api.runScreener(criteria),
  });
}

export function useBacktest() {
  return useMutation({
    mutationFn: api.runBacktest,
    onSuccess: (data) => useUiStore.getState().setBacktestResult(data),
  });
}

export function useTestAlert() {
  return useMutation({ mutationFn: api.testAlert });
}

export function useIngestCandles() {
  return useMutation({
    mutationFn: ({ symbol, timeframe }: { symbol: string; timeframe: string }) =>
      api.ingestCandles(symbol, timeframe),
  });
}

export function useFollowStrategy() {
  return useMutation({
    mutationFn: ({
      id,
      allocation_pct,
    }: {
      id: number;
      allocation_pct?: number;
    }) => api.followStrategy(id, allocation_pct),
  });
}

export function useUpgradeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tier: string) => api.upgradeSubscription(tier),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription }),
  });
}

export function usePaperOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.placePaperOrder,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.paperBalance }),
  });
}

export function useAgentAnalyze() {
  return useMutation({ mutationFn: api.analyzeWithAgent });
}
