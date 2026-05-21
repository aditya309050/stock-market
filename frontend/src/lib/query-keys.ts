export const queryKeys = {
  dashboard: ["dashboard"] as const,
  watchlist: ["watchlist"] as const,
  strategies: ["strategies"] as const,
  portfolios: ["portfolios"] as const,
  subscription: ["subscription"] as const,
  paperBalance: ["paper", "balance"] as const,
  marketplace: (skip = 0, limit = 20) => ["marketplace", skip, limit] as const,
  aiSuggestion: (symbol: string, risk: string, style: string) =>
    ["ai", "suggest", symbol, risk, style] as const,
};
