"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (PUBLIC_PATHS.includes(pathname)) return;
    if (!token) router.replace("/login");
  }, [pathname, router, token, hasHydrated]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        Loading…
      </div>
    );
  }

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;
  if (!token) return null;

  return <>{children}</>;
}
