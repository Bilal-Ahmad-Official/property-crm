"use client";

import { Button } from "@/components/ui";
import { Loader2, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@crm.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-white">
          <img src="/logo-icon.png" alt="PropCore" className="h-16 w-16 drop-shadow-lg" />
          <h1 className="text-xl font-bold tracking-tight">PropCore</h1>
          <p className="text-sm text-slate-400">Sign in to your workspace</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          ) : null}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                className="input pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type="password"
                className="input pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Demo account</p>
            <p>
              admin@crm.local · admin123 — agents: sara@crm.local / mike@crm.local · agent123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
