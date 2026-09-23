"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { useCopilotChat } from "@/hooks/queries";

export function AICopilot() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "";

  const [input, setInput] = useState("");
  type ChatMessage = { role: "user" | "assistant"; content: string };
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: initialSymbol
        ? `Hello! I am your AI Trading Copilot. I'm ready to analyze **${initialSymbol.toUpperCase()}** with real-time technical setups, VWAP, and trade levels. How can I assist you?`
        : "Hello! I am your AI Trading Copilot. How can I help you analyze the markets today?",
    },
  ]);

  const copilot = useCopilotChat();
  const autoTriggeredRef = useRef(false);

  // Auto trigger analysis if symbol is provided in query params
  useEffect(() => {
    if (initialSymbol && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      const initialPrompt = `Provide a comprehensive intraday & swing trading technical analysis for ${initialSymbol.toUpperCase()}, including VWAP trend, key support & resistance pivots, RSI momentum, and trade plan (entry, stop loss, target).`;
      
      setMessages((prev) => [
        ...prev,
        { role: "user", content: initialPrompt },
      ]);

      copilot.mutate(initialPrompt, {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
        },
        onError: (error) => {
          const msg =
            error instanceof ApiError
              ? error.status === 403
                ? "Please sign in to use the copilot."
                : error.message
              : "Error communicating with the AI engine.";
          setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
        },
      });
    }
  }, [initialSymbol, copilot]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || copilot.isPending) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    copilot.mutate(userMsg, {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      },
      onError: (error) => {
        const msg =
          error instanceof ApiError
            ? error.status === 403
              ? "Please sign in to use the copilot."
              : error.message
            : "Error communicating with the AI engine.";
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      },
    });
  };

  const handleQuickPrompt = (promptText: string) => {
    setInput(promptText);
    setMessages((prev) => [...prev, { role: "user", content: promptText }]);
    copilot.mutate(promptText, {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      },
      onError: (error) => {
        const msg =
          error instanceof ApiError
            ? error.status === 403
              ? "Please sign in to use the copilot."
              : error.message
            : "Error communicating with the AI engine.";
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Active Symbol Header Banner */}
      {initialSymbol && (
        <div className="px-6 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">
              {initialSymbol.toUpperCase()}
            </span>
            <span className="text-zinc-400">Stock Co-Pilot Context Active</span>
          </div>
          <Link
            href={`/stock/${initialSymbol.toUpperCase()}`}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
          >
            Open Chart ↗
          </Link>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 ${
                msg.role === "user"
                  ? "bg-white text-black font-medium"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-zinc-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-500"
                  >
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                  COPILOT
                </div>
              )}
              <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        {copilot.isPending && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
              <div className="flex gap-1.5 items-center h-5">
                <div
                  className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Action Pills */}
      {initialSymbol && (
        <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-900 flex gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => handleQuickPrompt(`What are the key support and resistance levels for ${initialSymbol.toUpperCase()} today?`)}
            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full border border-zinc-800 whitespace-nowrap transition-colors"
          >
            🎯 Support & Resistance
          </button>
          <button
            onClick={() => handleQuickPrompt(`Give me an intraday scalp trade plan with entry, stop loss, and risk-reward for ${initialSymbol.toUpperCase()}.`)}
            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full border border-zinc-800 whitespace-nowrap transition-colors"
          >
            ⚡ Intraday Trade Plan
          </button>
          <button
            onClick={() => handleQuickPrompt(`How is the volume and VWAP momentum looking for ${initialSymbol.toUpperCase()}?`)}
            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full border border-zinc-800 whitespace-nowrap transition-colors"
          >
            📊 VWAP & Volume Strength
          </button>
        </div>
      )}

      <div className="p-4 bg-zinc-950 border-t border-zinc-900">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              initialSymbol
                ? `Ask anything about ${initialSymbol.toUpperCase()} or overall market setups...`
                : "Ask about strategies, backtesting, or market analysis..."
            }
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-4 pl-6 pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 text-white placeholder-zinc-500 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || copilot.isPending}
            className="absolute right-2 p-2 bg-white text-black rounded-full hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
        <div className="text-center mt-3 text-xs text-zinc-600 font-medium">
          AI Copilot can make mistakes. Always verify trading signals.
        </div>
      </div>
    </div>
  );
}
