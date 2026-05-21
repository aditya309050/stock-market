import { getAuthToken } from "@/stores/auth-store";
import type {
  AIRecommendation,
  AnalyticsDashboard,
  BacktestResult,
  MarketplaceStrategy,
  PaperOrder,
  PaperOrderResponse,
  Portfolio,
  ScreenerCriteria,
  ScreenerResult,
  Strategy,
  Subscription,
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
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

function postQuery<T>(path: string, params: Record<string, string | number | boolean>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return request<T>(`${path}?${qs}`, { method: "POST" });
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

// ——— Strategies ———
export const getStrategies = () => request<Strategy[]>("/strategies/");
export const createStrategy = (data: {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  is_active?: boolean;
}) =>
  request<Strategy>("/strategies/", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteStrategy = (id: number) =>
  request<{ msg: string }>(`/strategies/${id}`, { method: "DELETE" });
export const toggleStrategy = (id: number, activate: boolean) =>
  postQuery<Strategy>(`/strategies/${id}/toggle`, { activate });

// ——— Portfolios ———
export const getPortfolios = () => request<Portfolio[]>("/portfolios/");
export const createPortfolio = (name: string) =>
  request<Portfolio>("/portfolios/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

// ——— Screener ———
export const runScreener = (criteria: ScreenerCriteria) =>
  request<ScreenerResult[]>("/screener/run", {
    method: "POST",
    body: JSON.stringify(criteria),
  });

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

// ——— Backtest ———
export const runBacktest = (data: {
  price_data: number[];
  fast_window?: number;
  slow_window?: number;
}) =>
  request<BacktestResult>("/backtest/run", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ——— Alerts ———
export const testAlert = (message: string) =>
  postQuery<{ msg: string; task_id: string }>("/alerts/test", { message });

// ——— Candles ———
export const ingestCandles = (symbol: string, timeframe: string) =>
  postQuery<{ msg: string; task_id: string }>("/candles/ingest", { symbol, timeframe });

// ——— Advanced alerts ———
export const processAlerts = (symbol: string, current_price: number) =>
  postQuery<{ msg: string }>("/advanced_alerts/process", { symbol, current_price });

// ——— Subscriptions ———
export const getSubscription = () => request<Subscription>("/subscriptions/me");
export const upgradeSubscription = (tier: string) =>
  postQuery<{ msg: string }>("/subscriptions/upgrade", { tier });

// ——— Agents ———
export const analyzeWithAgent = (data: {
  symbol: string;
  price_data?: number[];
  sentiment?: number;
  account_balance?: number;
  risk_tolerance?: string;
}) =>
  request<{ status: string; result: Record<string, unknown> }>("/agents/analyze", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ——— Marketplace ———
export const getMarketplace = (skip = 0, limit = 20) =>
  request<MarketplaceStrategy[]>(
    `/marketplace/?skip=${skip}&limit=${limit}`,
    {},
    false
  );
export const publishStrategy = (data: {
  strategy_id: number;
  title: string;
  description: string;
}) =>
  request<Record<string, unknown>>("/marketplace/publish", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ——— Social ———
export const followStrategy = (published_strategy_id: number, allocation_pct = 10) =>
  request<Record<string, unknown>>("/social/follow", {
    method: "POST",
    body: JSON.stringify({ published_strategy_id, allocation_pct }),
  });
export const unfollowStrategy = (publishedStrategyId: number) =>
  request<Record<string, unknown>>(`/social/unfollow/${publishedStrategyId}`, {
    method: "POST",
  });

// ——— Paper trading ———
export const getPaperBalance = () => request<{ balance: number }>("/paper/balance");
export const placePaperOrder = (order: PaperOrder) =>
  request<PaperOrderResponse>("/paper/order", {
    method: "POST",
    body: JSON.stringify(order),
  });
