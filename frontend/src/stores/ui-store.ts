import { create } from "zustand";
import type { BacktestResult, ScreenerCriteria } from "@/lib/types";

interface UiState {
  selectedSymbol: string | null;
  screenerCriteria: ScreenerCriteria;
  backtestResult: BacktestResult | null;
  setSelectedSymbol: (symbol: string | null) => void;
  setScreenerCriteria: (criteria: Partial<ScreenerCriteria>) => void;
  setBacktestResult: (result: BacktestResult | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedSymbol: null,
  screenerCriteria: {},
  backtestResult: null,
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  setScreenerCriteria: (criteria) =>
    set((s) => ({ screenerCriteria: { ...s.screenerCriteria, ...criteria } })),
  setBacktestResult: (backtestResult) => set({ backtestResult }),
}));
