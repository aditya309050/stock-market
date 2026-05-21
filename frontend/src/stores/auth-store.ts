import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  userEmail: string | null;
  hasHydrated: boolean;
  setAuth: (token: string, email: string) => void;
  clearAuth: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userEmail: null,
      hasHydrated: false,
      setAuth: (token, userEmail) => set({ token, userEmail }),
      clearAuth: () => set({ token: null, userEmail: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        userEmail: state.userEmail,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export const getAuthToken = () => useAuthStore.getState().token;
