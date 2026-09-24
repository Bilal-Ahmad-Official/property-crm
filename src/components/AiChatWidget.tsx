"use client";

import RichText from "@/components/RichText";
import { useChat } from "@/lib/useChat";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, Eraser, Send, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PAGE_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/properties": "Properties",
  "/leads": "Leads",
  "/contacts": "Contacts",
  "/deals": "Deals",
  "/tasks": "Tasks",
  "/reports": "Reports",
};

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/": ["Give me an overview", "What's my pipeline value?", "Any overdue tasks?"],
  "/properties": ["Show available properties", "Any apartments for rent?", "Summarize the portfolio"],
  "/leads": ["Summarize my leads", "Show new leads", "Which leads are in negotiation?"],
  "/contacts": ["Find contacts", "Show all buyers", "List landlords"],
  "/deals": ["What's my pipeline value?", "List deals in closing", "Won revenue this year?"],
  "/tasks": ["Summarize my tasks", "Any overdue tasks?", "Remind me to follow up on leads tomorrow"],
  "/reports": ["Won revenue this year?", "Summarize deals", "Give me an overview"],
};

function pageName(pathname: string): string {
  const base = "/" + (pathname.split("/")[1] || "");
  return PAGE_NAMES[base] || "Dashboard";
}

export default function AiChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { messages, loading, aiConfigured, error, send, clear } = useChat("widget", pageName(pathname));
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = PAGE_SUGGESTIONS[("/" + (pathname.split("/")[1] || ""))] || PAGE_SUGGESTIONS["/"];

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  async function submit() {
    const text = input;
    setInput("");
    await send(text);
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div className="flex h-[560px] max-h-[calc(100vh-6rem)] w-[390px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand-700 to-brand-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bot size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Aria · AI Assistant</p>
                <p className="text-[11px] text-white/75">
                  {aiConfigured === null ? "Connecting…" : aiConfigured ? "Connected to AI model" : "Built-in assistant mode"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clear}
                title="Clear conversation"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <Eraser size={15} />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.length === 0 && !loading ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center">
                <p className="text-sm font-semibold text-slate-600">Hi, I'm Aria 👋</p>
                <p className="mt-1 text-xs text-slate-500">
                  I can search properties, summarize leads & deals, and create tasks for you — across every module.
                </p>
              </div>
            ) : null}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-2 text-[13px] leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-brand-600 text-white"
                      : "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-700"
                  )}
                >
                  {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
                  {m.actions && m.actions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                      {m.actions.map((a, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                        >
                          <CheckCircle2 size={10} />
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
            ) : null}
          </div>

          {/* Suggestions + input */}
          <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask about properties, leads, deals…"
                className="input max-h-24 flex-1 resize-none py-2"
              />
              <button
                onClick={submit}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Ask Aria — AI assistant"
        className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:scale-105 hover:bg-brand-700"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
        {!open ? (
          <span className="absolute -left-1 top-1/2 hidden -translate-x-full -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100 lg:block">
            Ask Aria
          </span>
        ) : null}
      </button>
    </div>
  );
}
