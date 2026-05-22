import { useAuthStore } from "@/stores/auth-store";
import { useAuthActions } from "@/hooks/queries";

/** Auth state + actions (Zustand). */
export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const userEmail = useAuthStore((s) => s.userEmail);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { loginMutation, registerMutation, logout } = useAuthActions();

  return {
    isAuthenticated: !!token,
    isLoading: !hasHydrated,
    hasHydrated,
    user: userEmail ? { id: 0, email: userEmail } : null,
    subscription: null,
    login: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    register: (email: string, password: string, fullName?: string) =>
      registerMutation.mutateAsync({ email, password, fullName }),
    logout,
    loginMutation,
    registerMutation,
  };
}
