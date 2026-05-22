export interface NSEScanFilters {
  auto?: boolean;
  timeframes?: string[];
  index: string;
}

export interface NSEScanResult {
  symbol: string;
  matched_timeframes: string[];
  signals_by_tf: Record<string, Record<string, unknown>>;
  ai_score?: number;
  swing_signal?: string;
  swing_tags?: string[];
  ai_note?: string;
}

export interface NSEScanResponse {
  scanned: number;
  matched: number;
  results: NSEScanResult[];
  scan_id?: number;
  summary?: string;
}

export interface NSEMarketOverview {
  gainers: { symbol: string; last_price?: number; change_pct?: number }[];
  losers: { symbol: string; last_price?: number; change_pct?: number }[];
}
