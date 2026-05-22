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
