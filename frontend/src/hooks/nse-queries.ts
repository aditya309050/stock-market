import { useMutation, useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { NSEScanFilters } from "@/lib/nse-types";

const authed = () => !!useAuthStore.getState().token;

export const nseKeys = {
  symbols: (index: string) => ["nse", "symbols", index] as const,
  overview: (index: string) => ["nse", "overview", index] as const,
  quote: (symbol: string, tf: string) => ["nse", "quote", symbol, tf] as const,
  history: ["nse", "scan-history"] as const,
};

export function useNSESymbols(index = "NIFTY 50") {
  return useQuery({
    queryKey: nseKeys.symbols(index),
    queryFn: () => api.getNSESymbols(index),
    enabled: authed(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useNSEMarketOverview(index = "NIFTY 50") {
  return useQuery({
    queryKey: nseKeys.overview(index),
    queryFn: () => api.getNSEMarketOverview(index),
    enabled: authed(),
    refetchInterval: 60_000,
  });
}

export function useNSEQuote(symbol: string | undefined, timeframe = "1d") {
  return useQuery({
    queryKey: nseKeys.quote(symbol ?? "", timeframe),
    queryFn: () => api.getNSEQuote(symbol!, timeframe),
    enabled: authed() && !!symbol,
  });
}

export function useNSEScan() {
  return useMutation({
    mutationFn: ({
      filters,
      symbols,
    }: {
      filters: NSEScanFilters;
      symbols?: string[];
    }) => api.runNSEScan(filters, symbols),
  });
}

export function useNSEScanAI() {
  return useMutation({
    mutationFn: ({
      filters,
      symbols,
    }: {
      filters: NSEScanFilters;
      symbols?: string[];
    }) => api.runNSEScanWithAI(filters, symbols),
  });
}

export function useNSESmartScan() {
  return useMutation({
    mutationFn: ({ index, symbol }: { index: string; symbol?: string }) =>
      api.runNSESmartScan(index, symbol),
  });
}

export function useNSEScanHistory() {
  return useQuery({
    queryKey: nseKeys.history,
    queryFn: api.getNSEScanHistory,
    enabled: authed(),
  });
}
