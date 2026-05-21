"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { ApiError } from "@/lib/api";
import { useScreener, useIngestCandles } from "@/hooks/queries";
import { useUiStore } from "@/stores/ui-store";

export default function ScreenerPage() {
  const criteria = useUiStore((s) => s.screenerCriteria);
  const setScreenerCriteria = useUiStore((s) => s.setScreenerCriteria);

  const screener = useScreener();
  const ingest = useIngestCandles();

  const error =
    screener.error instanceof ApiError
      ? screener.error.message
      : ingest.error instanceof ApiError
        ? ingest.error.message
        : "";

  const run = () => screener.mutate(criteria);

  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold">Stock Screener</h1>
          <p className="text-zinc-400 mt-1">
            Filters stored in Zustand · results from React Query mutation
          </p>
        </header>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-500">Sector</label>
            <input
              value={criteria.sector ?? ""}
              onChange={(e) => setScreenerCriteria({ sector: e.target.value })}
              placeholder="Technology"
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Min volume</label>
            <input
              type="number"
              value={criteria.min_volume ?? ""}
              onChange={(e) =>
                setScreenerCriteria({
                  min_volume: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Max P/E</label>
            <input
              type="number"
              value={criteria.max_pe_ratio ?? ""}
              onChange={(e) =>
                setScreenerCriteria({
                  max_pe_ratio: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={run}
            disabled={screener.isPending}
            className="md:col-span-3 bg-white text-black font-medium py-2.5 rounded-lg hover:bg-zinc-200 disabled:opacity-50"
          >
            {screener.isPending ? "Running…" : "Run screener"}
          </button>
        </div>

        {screener.data && screener.data.length > 0 && (
          <div className="overflow-x-auto border border-zinc-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 text-left">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Market cap</th>
                  <th className="px-4 py-3">P/E</th>
                  <th className="px-4 py-3">Volume</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {screener.data.map((r) => (
                  <tr key={r.symbol} className="border-t border-zinc-800">
                    <td className="px-4 py-3 font-medium">{r.symbol}</td>
                    <td className="px-4 py-3 text-zinc-400">{r.sector}</td>
                    <td className="px-4 py-3">${(r.market_cap / 1e9).toFixed(1)}B</td>
                    <td className="px-4 py-3">{r.pe_ratio}</td>
                    <td className="px-4 py-3">{(r.volume / 1e6).toFixed(1)}M</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          ingest.mutate(
                            { symbol: r.symbol, timeframe: "1h" },
                            { onSuccess: (res) => alert(res.msg) }
                          )
                        }
                        disabled={ingest.isPending}
                        className="text-xs text-blue-400 hover:underline disabled:opacity-50"
                      >
                        Ingest candles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
