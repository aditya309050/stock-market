import { MainLayout } from "@/components/layout/MainLayout";

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Market Dashboard</h1>
            <p className="text-zinc-400 mt-1">Live overview of your portfolio and active strategies.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              New Alert
            </button>
            <button className="bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              Build Strategy
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Portfolio Summary Card */}
          <div className="col-span-1 md:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Total Portfolio Value</h2>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold">$125,430.50</span>
              <span className="text-emerald-400 text-sm font-medium">+$450.20 (0.36%)</span>
            </div>
            <div className="mt-6 h-48 bg-zinc-800/30 rounded-lg flex items-center justify-center border border-zinc-800/50">
              <span className="text-zinc-500 text-sm">TradingView Chart Placeholder</span>
            </div>
          </div>

          {/* AI Insights Card */}
          <div className="col-span-1 bg-gradient-to-b from-blue-900/20 to-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-medium text-blue-400 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              AI Market Summary
            </h2>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Tech stocks are rallying today following positive earnings reports from major players. The energy sector saw a slight dip.
              </p>
              <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/30">
                <p className="text-xs text-blue-200">
                  <span className="font-semibold">Recommendation:</span> Consider tightening stop-losses on NVDA as it approaches resistance at $950.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Strategies */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Active Strategies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-zinc-100">SMA Crossover</h3>
                  <div className="h-2 w-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">AAPL • 1h timeframe</p>
                <div className="mt-4 flex justify-between items-end">
                  <div>
                    <p className="text-xs text-zinc-400">Total Return</p>
                    <p className="text-emerald-400 font-medium">+12.5%</p>
                  </div>
                  <button className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-700">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
