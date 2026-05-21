"use client";

import React, { useState } from "react";
import { ApiError } from "@/lib/api";
import { useCopilotChat } from "@/hooks/queries";

export function AICopilot() {
  const [input, setInput] = useState("");
  type ChatMessage = { role: "user" | "assistant"; content: string };
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your AI Trading Copilot. How can I help you analyze the markets today?",
    },
  ]);

  const copilot = useCopilotChat();

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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 ${
                msg.role === "user"
                  ? "bg-white text-black"
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
                  className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-950 border-t border-zinc-900">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about strategies, backtesting, or market analysis..."
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
