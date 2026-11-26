"use client";

import React, { useState, useEffect } from "react";
import {
  getAlertStatus,
  sendTestAlert,
  getAlertHistory,
  triggerScanAndDispatch,
  type AlertStatusResponse,
  type AlertHistoryItem,
} from "@/lib/api";

interface TelegramAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelegramAlertModal({ isOpen, onClose }: TelegramAlertModalProps) {
  const [status, setStatus] = useState<AlertStatusResponse | null>(null);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const loadData = async () => {
    try {
      const [st, hist] = await Promise.all([getAlertStatus(), getAlertHistory()]);
      setStatus(st);
      setHistory(hist);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAlert = async () => {
    setLoading(true);
    setActionMsg("");
    try {
      const res = await sendTestAlert();
      setActionMsg(res.message);
      await loadData();
    } catch (err: any) {
      setActionMsg(err?.message || "Failed to trigger test alert.");
    } finally {
      setLoading(false);
    }
  };

  const handleScanNow = async () => {
    setLoading(true);
    setActionMsg("");
    try {
      const res = await triggerScanAndDispatch("NIFTY 50");
      setActionMsg(`Scan complete! Dispatched ${res.dispatched_count} alerts.`);
      await loadData();
    } catch (err: any) {
      setActionMsg(err?.message || "Failed to scan and dispatch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-white font-sans animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h2 className="text-lg font-bold">Telegram Trading Alert Bot</h2>
              <p className="text-xs text-zinc-400">Instant Golden Cross, VWAP Breakout, and Depth Wall alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Status Badge */}
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-medium">Bot Configuration Status</div>
            <div className="text-sm font-bold mt-0.5 flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${status?.is_configured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span>{status?.is_configured ? "Connected to Telegram Channel" : "Simulation / Log Mode (Bot Token unset)"}</span>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {history.length} alerts logged
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleTestAlert}
            className="flex-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 py-2.5 text-xs font-bold text-white transition flex items-center justify-center gap-1.5"
          >
            <span>📡</span> Send Test Ping
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleScanNow}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-violet-900/30 flex items-center justify-center gap-1.5"
          >
            <span>⚡</span> Scan & Dispatch Now
          </button>
        </div>

        {/* Action message feedback */}
        {actionMsg && (
          <div className="mt-3 rounded-lg bg-zinc-900 border border-zinc-700 p-2 text-xs text-zinc-300 font-medium">
            ℹ️ {actionMsg}
          </div>
        )}

        {/* Recent Alerts Feed */}
        <div className="mt-4 flex-1 overflow-hidden flex flex-col min-h-[220px]">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Recent Dispatched Alerts</div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {history.length === 0 ? (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 text-center text-xs text-zinc-500">
                No alerts dispatched yet. Click &quot;Send Test Ping&quot; or &quot;Scan &amp; Dispatch Now&quot; above.
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                    <span className="font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.status === "SENT" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div
                    className="text-zinc-200 leading-relaxed text-xs font-sans"
                    dangerouslySetInnerHTML={{ __html: item.text.replace(/\n/g, "<br/>") }}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Setup Guide Footer */}
        <div className="mt-4 border-t border-zinc-800 pt-3 text-[11px] text-zinc-500">
          💡 <b>Setup in 1 minute:</b> Create a bot on Telegram with <code className="text-zinc-300">@BotFather</code> and add <code className="text-zinc-300">TELEGRAM_BOT_TOKEN</code> &amp; <code className="text-zinc-300">TELEGRAM_CHAT_ID</code> in your <code className="text-zinc-300">backend/.env</code>.
        </div>

      </div>
    </div>
  );
}
