"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ApiError } from "@/lib/api";
import {
  useStrategies,
  useStrategyMutations,
  useBacktest,
  useAgentAnalyze,
} from "@/hooks/queries";
import { useUiStore } from "@/stores/ui-store";

export default function StrategiesPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: strategies, isLoading, error } = useStrategies();
  const { create, remove, toggle } = useStrategyMutations();
  const backtest = useBacktest();
  const agent = useAgentAnalyze();
  const backtestResult = useUiStore((s) => s.backtestResult);

  const mutationError =
    create.error ?? remove.error ?? toggle.error ?? backtest.error ?? agent.error;
  const errorMsg =
    error instanceof ApiError
      ? error.message
      : mutationError instanceof ApiError
        ? mutationError.message
        : "";

  const handleCreate = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        name,
        description,
        parameters: { fast_window: 10, slow_window: 50 },
        is_active: true,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
        },
      }
    );
  };

  const runBacktest = () => {
    const samplePrices = Array.from(
      { length: 100 },
      (_, i) => 100 + Math.sin(i / 5) * 10 + i * 0.1
    );
    backtest.mutate({
      price_data: samplePrices,
      fast_window: 10,
      slow_window: 50,
    });
  };

  const runAgent = () => {
    agent.mutate(
      { symbol: "AAPL", sentiment: 0.5, risk_tolerance: "medium" },
      {
        onSuccess: (result) => {
          alert(
            `Agent analysis: ${JSON.stringify((result.result as { analysis?: unknown })?.analysis ?? result, null, 2).slice(0, 300)}…`
          );
        },
      }
    );
  };

  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold">Strategies</h1>
          <p className="text-zinc-400 mt-1">
            React Query mutations with automatic cache invalidation
          </p>
        </header>

        {errorMsg && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
            {errorMsg}
          </p>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Create strategy</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Strategy name"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm h-20"
          />
          <button
            onClick={handleCreate}
            disabled={create.isPending}
            className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={runBacktest}
            disabled={backtest.isPending}
            className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-md text-sm disabled:opacity-50"
          >
            {backtest.isPending ? "Running…" : "Run sample backtest"}
          </button>
          <button
            onClick={runAgent}
            disabled={agent.isPending}
            className="bg-blue-900/40 border border-blue-800 hover:bg-blue-900/60 px-4 py-2 rounded-md text-sm text-blue-200 disabled:opacity-50"
          >
            Run agent analyze (AAPL)
          </button>
        </div>

        {backtestResult && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-sm space-y-1">
            <h3 className="font-semibold mb-2">Backtest result (Zustand)</h3>
            {backtestResult.error ? (
              <p className="text-amber-400">{backtestResult.error}</p>
            ) : (
              <>
                <p>Return: {backtestResult.total_return_pct}%</p>
                <p>Win rate: {backtestResult.win_rate_pct}%</p>
                <p>Max drawdown: {backtestResult.max_drawdown_pct}%</p>
                <p>Trades: {backtestResult.total_trades}</p>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {strategies?.map((s) => (
              <li
                key={s.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex justify-between items-start gap-4"
              >
                <div>
                  <h3 className="font-medium">{s.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{s.description}</p>
                  <p className="text-xs text-zinc-600 mt-2">
                    {s.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() =>
                      toggle.mutate({ id: s.id, activate: !s.is_active })
                    }
                    disabled={toggle.isPending}
                    className="text-xs bg-zinc-800 px-2 py-1 rounded hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => remove.mutate(s.id)}
                    disabled={remove.isPending}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MainLayout>
  );
}
