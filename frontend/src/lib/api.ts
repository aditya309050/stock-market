import { getAuthToken, useAuthStore } from "@/stores/auth-store";
import type {
  NSEMarketOverview,
  NSEScanFilters,
  NSEScanResponse,
} from "./nse-types";
import type {
  AIRecommendation,
  AnalyticsDashboard,
  Token,
  User,
  Watchlist,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return getAuthToken();
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d: { msg?: string }) => d.msg ?? "").join(", ");
    }
    return JSON.stringify(data);
  } catch {
    return res.statusText || "Request failed";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof URLSearchParams)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const message = await parseError(res);
    if (
      auth &&
      (res.status === 401 || res.status === 403) &&
      typeof window !== "undefined"
    ) {
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ——— Auth ———
export async function login(email: string, password: string): Promise<Token> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json();
}

export const register = (data: {
  email: string;
  password: string;
  full_name?: string;
}) =>
  request<User>("/auth/register", { method: "POST", body: JSON.stringify(data) }, false);

// ——— Analytics ———
export const getDashboard = () =>
  request<AnalyticsDashboard>("/analytics/dashboard");

// ——— Watchlist ———
export const getWatchlist = () => request<Watchlist[]>("/watchlist/");
export const addToWatchlist = (symbol: string) =>
  request<Watchlist>("/watchlist/", {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });
export const removeFromWatchlist = (itemId: number) =>
  request<{ msg: string }>(`/watchlist/${itemId}`, { method: "DELETE" });

// ——— AI ———
export const getAISuggestion = (data: {
  symbol: string;
  risk_level: string;
  trading_style: string;
}) =>
  request<AIRecommendation>("/ai/suggest", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ——— Copilot ———
export const copilotChat = (message: string) =>
  request<{ reply: string }>("/copilot/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });

// ——— NSE Screener ———
export const getNSESymbols = (index = "NIFTY 50") =>
  request<{ symbols: string[]; count: number; index: string }>(
    `/nse/symbols?index=${encodeURIComponent(index)}`
  );

export const getNSEMarketOverview = (index = "NIFTY 50") =>
  request<NSEMarketOverview>(
    `/nse/market-overview?index=${encodeURIComponent(index)}`
  );

export const getNSEQuote = (symbol: string, timeframe = "1d") =>
  request<{ symbol: string; timeframe: string; signals: Record<string, unknown> }>(
    `/nse/quote/${symbol}?timeframe=${timeframe}`
  );

export const runNSEScan = (filters: NSEScanFilters, symbols?: string[]) =>
  request<NSEScanResponse>("/nse/scan", {
    method: "POST",
    body: JSON.stringify({ filters, symbols }),
  });

export const runNSEScanWithAI = (filters: NSEScanFilters, symbols?: string[]) =>
  request<{ scan: NSEScanResponse; prediction: string }>("/nse/ai-predict", {
    method: "POST",
    body: JSON.stringify({ filters, symbols }),
  });

/** One-click: all indicators + AI swing picks (no manual filters). */
export const runNSESmartScan = (index: string, symbol?: string) => {
  const params = new URLSearchParams({ index });
  if (symbol) params.set("symbol", symbol);
  return request<NSEScanResponse>(`/nse/smart-scan?${params}`, { method: "POST" });
};

export const getNSEScanHistory = () =>
  request<
    { id: number; created_at: string; index: string; scanned: number; matched: number }[]
  >("/nse/scan/history");

export const exportNSEScanCsv = (scanId: number) =>
  `${API_BASE}/nse/scan/${scanId}/export`;

// ——— Sector Analysis ———
export interface SectorResult {
  rank: number;
  sector: string;
  display_name: string;
  ticker: string;
  sector_return: number;
  nifty_return: number;
  relative_strength: number;
  chg_5d: number;
  chg_21d: number;
  category: "OUTPERFORM" | "MIXED" | "UNDERPERFORM";
  trend: "up" | "mixed" | "down";
}

export interface SectorScreenerResponse {
  timeframe: string;
  benchmark_symbol: string;
  benchmark_name: string;
  benchmark_return: number;
  sentiment: "NEUTRAL" | "BULLISH" | "BEARISH";
  rotation: {
    outperform_count: number;
    mixed_count: number;
    underperform_count: number;
  };
  results: SectorResult[];
  outperform_list: SectorResult[];
  mixed_list: SectorResult[];
  underperform_list: SectorResult[];
  chart_data: Record<string, any>[];
}

export const getSectorScreener = (timeframe = "1M", benchmark = "NIFTY_500") =>
  request<SectorScreenerResponse>(
    `/sector-screener?timeframe=${encodeURIComponent(timeframe)}&benchmark=${encodeURIComponent(benchmark)}`
  );

// ——— Real DMA & S/R Confluence Scanner ———
export interface SRLevelSchema {
  level_type: "SUPPORT" | "RESISTANCE";
  label: string;
  price: number;
  zone_low: number;
  zone_high: number;
  distance_pct: number;
  strength: number;
  test_count: number;
  reasons: string[];
}

export interface VolumeProfileSchema {
  poc: number;
  vah: number;
  val: number;
}

export interface DMAMetricsSchema {
  symbol: string;
  last_price: number;
  dma20: number;
  dma50: number;
  dma200: number;
  prev_dma50: number;
  prev_dma200: number;
  gap_pct: number;
  dist_50_pct: number;
  dist_200_pct: number;
  dma50_slope: number;
  dma50_slope_trend: string;
  dma200_slope: number;
  dma200_slope_trend: string;
  rsi: number;
  volume_mult: number;
  is_golden_cross: boolean;
  is_crossed_today: boolean;
  is_recent_cross: boolean;
  is_established_cross: boolean;
  is_near_cross: boolean;
  is_above_200: boolean;
  is_above_50: boolean;
  status: string;
  cross_category: string;
  setup_category: string;
  score: number;
}

export interface DMAScanItem {
  symbol: string;
  price: number;
  dma50: number;
  dma200: number;
  dist_50_pct: number;
  dist_200_pct: number;
  dma50_slope_trend: string;
  rsi: number;
  volume_mult: number;
  setup_category: string;
  score: number;
  is_golden_cross: boolean;
  nearest_support?: SRLevelSchema;
  nearest_resistance?: SRLevelSchema;
  confluence_tags: string[];
}

export interface DMAScanResponse {
  index: string;
  scanned: number;
  matched: number;
  results: DMAScanItem[];
}

export interface StockDetailResponse {
  symbol: string;
  price: number;
  dma_metrics: DMAMetricsSchema;
  supports: SRLevelSchema[];
  resistances: SRLevelSchema[];
  volume_profile: VolumeProfileSchema;
  confluence_tags: string[];
  chart_data: Record<string, any>[];
}

export const runDMAScan = (index = "NIFTY 500", filter_category?: string) => {
  const params = new URLSearchParams({ index });
  if (filter_category && filter_category !== "ALL") params.set("filter_category", filter_category);
  return request<DMAScanResponse>(`/dma-screener/scan?${params}`);
};

export const getDMAStockDetail = (symbol: string) =>
  request<StockDetailResponse>(`/dma-screener/stock/${encodeURIComponent(symbol)}`);


