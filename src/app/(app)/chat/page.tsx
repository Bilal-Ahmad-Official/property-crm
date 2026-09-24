"use client";

import RichText from "@/components/RichText";
import { Badge, Button, Card } from "@/components/ui";
import { useChat } from "@/lib/useChat";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, Eraser, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Give me an overview",
  "Show available properties under $900k",
  "Summarize my leads",
  "What's my pipeline value?",
  "Any overdue tasks?",
  "Remind me to follow up on leads tomorrow",
  "Find contact James Wilson",
  "Which deals are in closing?",
];

export default function ChatPage() {
  const { messages, loading, aiConfigured, model, error, send, clear } = useChat("main", "AI Assistant");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function submit() {
    const text = input;
    setInput("");
    await send(text);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-4xl flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-md">
            <Bot size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Aria — AI Assistant</h1>
            <p className="text-xs text-slate-500">
              Connected to every module: properties, leads, contacts, deals, tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            value={aiConfigured ? "COMPLETED" : "OTHER"}
            className={cn(
              "!text-[11px]",
              aiConfigured ? "!bg-emerald-50 !text-emerald-700" : "!bg-amber-50 !text-amber-700"
            )}
          >
            {aiConfigured === null
              ? "Connecting…"
              : aiConfigured
                ? `AI model${model ? `: ${model}` : ""}`
                : "Built-in assistant mode"}
          </Badge>
          <Button variant="secondary" size="sm" onClick={clear}>
            <Eraser size={13} /> Clear
          </Button>
        </div>
      </div>

      {!aiConfigured ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <span className="font-semibold">Built-in mode:</span> no AI API key is configured, so Aria answers using
          the built-in rule-based engine (still queries your live CRM data). To enable a full AI model, set{" "}
          <code className="rounded bg-amber-100 px-1">AI_API_KEY</code> /{" "}
          <code className="rounded bg-amber-100 px-1">AI_BASE_URL</code> /{" "}
          <code className="rounded bg-amber-100 px-1">AI_MODEL</code> in{" "}
          <code className="rounded bg-amber-100 px-1">.env</code> and restart — any OpenAI-compatible provider works
          (OpenAI, Z.ai GLM, OpenRouter, Groq, Ollama…).
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <Sparkles size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold">Ask Aria anything about your CRM</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                  Aria can search listings, summarize leads and deals, report on tasks, find contacts — and take
                  actions like creating tasks, moving leads through the pipeline and adding notes.
                </p>
              </div>
              <div className="flex max-w-xl flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={loading}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "rounded-2xl rounded-br-md bg-brand-600 text-white"
                    : "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-700"
                )}
              >
                {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
                {m.actions && m.actions.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                    {m.actions.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                      >
                        <CheckCircle2 size={11} />
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
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
                <span className="ml-1 text-xs text-slate-400">Thinking…</span>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-4 py-3">
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
              placeholder="Ask about properties, leads, deals, tasks… (Enter to send)"
              className="input max-h-32 flex-1 resize-none"
            />
            <Button onClick={submit} disabled={loading || !input.trim()} className="shrink-0">
              <Send size={14} /> Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
