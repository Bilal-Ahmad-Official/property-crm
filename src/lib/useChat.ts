"use client";

import { useCallback, useEffect, useState } from "react";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: string[];
  mode?: string;
  createdAt?: string;
};

export function useChat(sessionId: string, pageContext?: string) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (cancelled) return;
        setMessages(
          (data.messages || [])
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { id: string; role: "user" | "assistant"; content: string; createdAt: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            }))
        );
        setAiConfigured(Boolean(data.aiConfigured));
        setModel(data.model ?? null);
      } catch {
        // history is non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;
      setError(null);
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content }]);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: content, pageContext }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        setMessages((prev) => [
          ...prev,
          {
            id: data.messageId || `a-${Date.now()}`,
            role: "assistant",
            content: data.reply,
            actions: data.actions,
            mode: data.mode,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
      } finally {
        setLoading(false);
      }
    },
    [sessionId, pageContext, loading]
  );

  const clear = useCallback(async () => {
    try {
      await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    setMessages([]);
  }, [sessionId]);

  return { messages, loading, aiConfigured, model, error, send, clear };
}
