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
