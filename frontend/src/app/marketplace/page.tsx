"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { ApiError } from "@/lib/api";
import {
  useMarketplace,
  useFollowStrategy,
  useUpgradeSubscription,
  usePaperOrder,
} from "@/hooks/queries";

export default function MarketplacePage() {
  const { data: strategies, isLoading, error } = useMarketplace();
  const follow = useFollowStrategy();
  const upgrade = useUpgradeSubscription();
  const paperOrder = usePaperOrder();

  const mutationError = follow.error ?? upgrade.error ?? paperOrder.error;
  const errorMsg =
    error instanceof ApiError
      ? error.message
      : mutationError instanceof ApiError
        ? mutationError.message
        : "";

  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Strategy Marketplace</h1>
            <p className="text-zinc-400 mt-1">Public listing cached via React Query</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                upgrade.mutate("pro", {
                  onSuccess: (res) => alert(res.msg),
                })
              }
              disabled={upgrade.isPending}
              className="text-xs bg-emerald-900/40 border border-emerald-800 text-emerald-400 px-3 py-2 rounded-md disabled:opacity-50"
            >
              Upgrade to Pro
            </button>
            <button
              onClick={() =>
                paperOrder.mutate(
                  { symbol: "AAPL", qty: 10, side: "buy" },
                  {
                    onSuccess: (res) =>
                      alert(
                        `Order ${res.status}: ${res.reason ?? `filled @ $${res.filled_price}`}`
                      ),
                  }
                )
              }
              disabled={paperOrder.isPending}
              className="text-xs bg-zinc-800 px-3 py-2 rounded-md hover:bg-zinc-700 disabled:opacity-50"
            >
              Paper buy AAPL
            </button>
          </div>
        </header>

        {errorMsg && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
            {errorMsg}
          </p>
        )}

        {isLoading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <div className="grid gap-4">
            {strategies?.map((s) => (
              <div
                key={s.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  <p className="text-sm text-zinc-500">by {s.author}</p>
                  <p className="text-sm text-zinc-400 mt-2">{s.description}</p>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="text-emerald-400">+{s.monthly_return}% / mo</span>
                    <span className="text-zinc-500">{s.total_subscribers} subscribers</span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    follow.mutate(
                      { id: s.id },
                      { onSuccess: () => alert("Subscribed to strategy copy-trading") }
                    )
                  }
                  disabled={follow.isPending}
                  className="shrink-0 h-fit bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
                >
                  Follow
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
