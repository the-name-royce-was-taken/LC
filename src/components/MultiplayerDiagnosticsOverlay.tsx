"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, Clipboard, Trash2, X } from "lucide-react";
import { getMultiplayerManager, subscribeMultiplayerDiagnostics, type MultiplayerDiagnosticEntry } from "@/lib/sim/multiplayer-sync";

const MAX_LOGS = 600;

export default function MultiplayerDiagnosticsOverlay() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<MultiplayerDiagnosticEntry[]>([]);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const add = (entry: MultiplayerDiagnosticEntry) => setLogs((prev) => [...prev, entry].slice(-MAX_LOGS));
    const unsubscribe = subscribeMultiplayerDiagnostics(add);
    const log = (message: string, level: MultiplayerDiagnosticEntry["level"] = "info", details?: unknown) =>
      add({ time: new Date().toISOString(), message, level, details: details === undefined ? undefined : JSON.stringify(details) });
    const mp = getMultiplayerManager();
    let previous = "";
    const poll = () => {
      const s = mp.status;
      const snapshot = JSON.stringify({ mode: s.mode, state: s.state, roomCode: s.roomCode, connected: s.connectedWebRtcPeers, text: s.statusText });
      setStatus(s.statusText);
      if (snapshot !== previous) {
        previous = snapshot;
        log("Multiplayer manager status changed", s.state === "error" ? "error" : "info", { mode: s.mode, state: s.state, roomCode: s.roomCode, connectedPeers: s.connectedWebRtcPeers, statusText: s.statusText });
      }
    };
    poll();
    const timer = window.setInterval(poll, 500);
    const onOnline = () => log("Browser reports network online");
    const onOffline = () => log("Browser reports network offline", "error");
    const onError = (e: ErrorEvent) => log("Window error", "error", { message: e.message, filename: e.filename, line: e.lineno, column: e.colno });
    const onReject = (e: PromiseRejectionEvent) => log("Unhandled promise rejection", "error", { reason: String(e.reason) });
    const onVisibility = () => log("Page visibility changed", "info", { visibilityState: document.visibilityState });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    document.addEventListener("visibilitychange", onVisibility);
    log("Diagnostics initialized", "info", { userAgent: navigator.userAgent, online: navigator.onLine, url: location.href, secureContext: window.isSecureContext, rtcSupported: typeof RTCPeerConnection !== "undefined", websocketSupported: typeof WebSocket !== "undefined" });
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean } }).connection;
    if (connection) log("Browser network hints", "info", connection);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, open]);

  const copyLogs = async () => {
    const text = logs.map((entry) => `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.message}${entry.details ? `\n  ${entry.details}` : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setLogs((prev) => [...prev, { time: new Date().toISOString(), level: "error", message: "Clipboard permission denied. Select and copy the visible logs manually." }]);
    }
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-2 z-[10000] w-[min(94vw,560px)] -translate-x-1/2 font-mono text-[11px] text-white">
      <div className="pointer-events-auto mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-white/20 bg-[#08090D]/65 px-3 py-1.5 shadow-lg backdrop-blur-md">
        <Activity className="h-3.5 w-3.5 text-[#CCFF00]" />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-6 items-center gap-2 font-bold tracking-wide">
          Logs <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">{logs.length}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {!open && <span className="max-w-[190px] truncate text-white/55">{status}</span>}
      </div>
      {open && (
        <section className="pointer-events-auto mt-2 overflow-hidden rounded-xl border border-white/15 bg-[#08090D]/80 shadow-2xl backdrop-blur-xl">
          <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="min-w-0">
              <div className="font-bold text-[#CCFF00]">Multiplayer diagnostics</div>
              <div className="truncate text-[10px] text-white/55">{status || "Waiting for multiplayer status…"}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => void copyLogs()} className="rounded-md bg-white/10 px-2.5 py-1.5 hover:bg-white/20"><Clipboard className="mr-1 inline h-3 w-3" />{copied ? "Copied" : "Copy"}</button>
              <button type="button" onClick={() => setLogs([])} title="Clear logs" className="rounded-md bg-white/10 p-1.5 hover:bg-white/20"><Trash2 className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setOpen(false)} title="Close logs" className="rounded-md bg-white/10 p-1.5 hover:bg-white/20"><X className="h-3.5 w-3.5" /></button>
            </div>
          </header>
          <div className="max-h-[min(58vh,420px)] overflow-y-auto px-3 py-2">
            {logs.length === 0 ? <p className="text-white/50">No logs yet.</p> : logs.map((entry, i) => (
              <div key={i} className="border-b border-white/[0.06] py-1.5 last:border-0">
                <div className="flex gap-2">
                  <span className="shrink-0 text-white/35">{new Date(entry.time).toLocaleTimeString()}</span>
                  <span className={entry.level === "error" ? "text-[#FF6B75]" : entry.level === "warn" ? "text-[#FFCA58]" : "text-[#CCFF00]"}>{entry.level.toUpperCase()}</span>
                  <span className="break-words text-white/90">{entry.message}</span>
                </div>
                {entry.details && <pre className="mt-1 whitespace-pre-wrap break-all pl-2 text-[10px] text-white/55">{entry.details}</pre>}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <footer className="border-t border-white/10 px-3 py-1.5 text-[10px] text-white/40">Logs stay in this tab only. Copy them and share here when a connection fails.</footer>
        </section>
      )}
    </div>
  );
}
