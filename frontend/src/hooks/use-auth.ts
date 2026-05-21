import { useAuthStore } from "@/stores/auth-store";
import { useSubscription, useAuthActions } from "@/hooks/queries";

/** Auth state + actions (Zustand + React Query subscription). */
export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const userEmail = useAuthStore((s) => s.userEmail);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { loginMutation, registerMutation, logout } = useAuthActions();

  return {
    isAuthenticated: !!token,
    isLoading: !hasHydrated || (!!token && subLoading),
    hasHydrated,
    user: userEmail ? { id: 0, email: userEmail } : null,
    subscription: subscription ?? null,
    login: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    register: (email: string, password: string, fullName?: string) =>
      registerMutation.mutateAsync({ email, password, fullName }),
    logout,
    loginMutation,
    registerMutation,
  };
}
