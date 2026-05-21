export interface Token {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name?: string | null;
  is_active?: boolean;
  is_superuser?: boolean;
}

export interface Watchlist {
  id: number;
  owner_id: number;
  symbol: string;
}

export interface Strategy {
  id: number;
  owner_id: number;
  name: string;
  description?: string | null;
  parameters: Record<string, unknown>;
  is_active: boolean;
}

export interface Portfolio {
  id: number;
  owner_id: number;
  name: string;
  total_balance: number;
  available_cash: number;
}

export interface ScreenerCriteria {
  min_market_cap?: number;
  max_pe_ratio?: number;
  min_volume?: number;
  sector?: string;
}

export interface ScreenerResult {
  symbol: string;
  market_cap: number;
  pe_ratio: number;
  volume: number;
  sector: string;
}

export interface AnalyticsDashboard {
  total_portfolio_value: number;
  daily_pnl: number;
  active_strategies_count: number;
  triggered_alerts_count: number;
  top_performers: { symbol: string; return: number }[];
}

export interface AIRecommendation {
  symbol: string;
  action: string;
  confidence_score: number;
  reasoning: string;
}

export interface Subscription {
  id: number;
  owner_id: number;
  tier: string;
  expires_at?: string | null;
}

export interface MarketplaceStrategy {
  id: number;
  title: string;
  author: string;
  monthly_return: number;
  total_subscribers: number;
  description: string;
}

export interface BacktestResult {
  total_return_pct?: number;
  win_rate_pct?: number;
  max_drawdown_pct?: number;
  total_trades?: number;
  error?: string;
}

export interface PaperOrder {
  symbol: string;
  qty: number;
  side: string;
  order_type?: string;
}

export interface PaperOrderResponse {
  order_id?: string;
  symbol?: string;
  qty?: number;
  side?: string;
  filled_price?: number;
  commission?: number;
  status: string;
  reason?: string;
}
