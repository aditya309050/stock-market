"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("adityaraj309050@gmail.com");
  const [password, setPassword] = useState("password123");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, fullName || undefined);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : mode === "login"
          ? "Login failed. Check your credentials."
          : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setEmail("adityaraj309050@gmail.com");
    setPassword("password123");
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0b0e] text-white flex flex-col lg:flex-row font-sans selection:bg-[#c4b5fd] selection:text-[#0a0b0e] overflow-x-hidden">
      
      {/* ── LEFT 50%: Hero, Form & Minimalist Controls ─────────────────────── */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 bg-[#0e1017] relative z-10 border-r border-white/10">
        
        {/* Subtle Ambient Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_20%,rgba(196,181,253,0.05)_0%,transparent_60%)] pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-10 flex items-center justify-between pb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-white flex items-center gap-1.5 cursor-pointer">
              screener<span className="text-[#c4b5fd] text-xl animate-pulse">✦</span>
            </span>
          </div>
        </header>

        {/* Center Content: Typography & Auth Form */}
        <div className="relative z-10 my-auto py-6 max-w-xl w-full mx-auto lg:mx-0 space-y-6">
          
          {/* Editorial Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-serif font-black tracking-tight text-white leading-[1.08]">
              Disc<span className="inline-flex items-center justify-center mx-0.5 text-[#c4b5fd] font-sans font-normal animate-pulse">✿</span>ver <br />
              <span className="italic font-serif font-normal text-zinc-300">Hidden Gems</span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg font-medium">
              Unlock high-probability derivatives breakout candidates, live Greeks, Max Pain payout anchors, and AI-validated setups ✦
            </p>
          </div>

          {/* Auth Form Card */}
          <div className="bg-[#141722]/90 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
            
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-black/50 border border-white/10 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className={`py-2.5 rounded-lg transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-[#c4b5fd] text-[#0f1017] shadow-md font-extrabold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); }}
                className={`py-2.5 rounded-lg transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-[#c4b5fd] text-[#0f1017] shadow-md font-extrabold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "register" && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-black/50 hover:bg-black/70 focus:bg-black/80 border border-white/10 focus:border-[#c4b5fd] focus:ring-1 focus:ring-[#c4b5fd] text-white placeholder:text-zinc-500 text-xs sm:text-sm rounded-xl pl-10 pr-4 py-3.5 transition-all outline-none font-medium"
                  />
                </div>
              )}

              {/* Email Field */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Username or Email"
                  required
                  className="w-full bg-black/50 hover:bg-black/70 focus:bg-black/80 border border-white/10 focus:border-[#c4b5fd] focus:ring-1 focus:ring-[#c4b5fd] text-white placeholder:text-zinc-500 text-xs sm:text-sm rounded-xl pl-10 pr-4 py-3.5 transition-all outline-none font-medium"
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full bg-black/50 hover:bg-black/70 focus:bg-black/80 border border-white/10 focus:border-[#c4b5fd] focus:ring-1 focus:ring-[#c4b5fd] text-white placeholder:text-zinc-500 text-xs sm:text-sm rounded-xl pl-10 pr-10 py-3.5 transition-all outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-black/60 border-white/20 text-[#c4b5fd] accent-[#c4b5fd] cursor-pointer"
                  />
                  <span className="text-[12px] font-medium">{mode === "login" ? "Remember me" : "I agree to terms"}</span>
                </label>

                {mode === "login" && (
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Please contact administrator to reset password.");
                    }}
                    className="text-[12px] text-[#c4b5fd] hover:text-[#ddd6fe] font-medium transition-colors"
                  >
                    Forgot password?
                  </a>
                )}
              </div>

              {/* Submit Pill CTA Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-4 rounded-full bg-[#c4b5fd] hover:bg-[#ddd6fe] text-[#0f1017] font-black text-sm shadow-xl shadow-[#c4b5fd]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#0f1017] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === "login" ? "Get Started" : "Create Account"}</span>
                    <span className="text-base font-bold">→</span>
                  </>
                )}
              </button>
            </form>

            {/* Fast Autofill Helper */}
            {mode === "login" && (
              <div className="pt-2 flex items-center justify-between text-xs border-t border-white/5">
                <span className="text-zinc-500 text-[11px]">Testing demo account?</span>
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="text-[#c4b5fd] hover:text-[#ddd6fe] font-bold text-[11px] underline underline-offset-2 cursor-pointer"
                >
                  Autofill Credentials
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Minimalist Left Footer */}
        <footer className="relative z-10 pt-4 flex items-center justify-between text-xs text-zinc-500 border-t border-white/5">
          <div>© 2026 F&amp;O Screener Pro</div>
          <div className="text-[11px] text-zinc-500">Derivatives Analytics Engine</div>
        </footer>

      </div>

      {/* ── RIGHT 50%: 100% Full-bleed Image ─────────────────────────────────── */}
      <div className="hidden lg:block lg:w-1/2 min-h-screen relative overflow-hidden bg-[#121520]">
        
        {/* Full 50% Image Edge-to-Edge */}
        <img
          src="/editorial-trader.jpg"
          alt="Trader Discovering Market Breakouts"
          className="w-full h-full object-cover object-center"
        />

        {/* Bottom Floating Caption Badge */}
        <div className="absolute bottom-6 inset-x-8 px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-between text-xs text-zinc-400 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c4b5fd] animate-ping" />
            <span className="font-serif italic text-white text-sm">Real-time Breakout Intelligence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-200">
              Institutional Screener
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
