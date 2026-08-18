"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScreenerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sector-analysis");
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Redirecting to Sector Analysis…</p>
    </div>
  );
}
