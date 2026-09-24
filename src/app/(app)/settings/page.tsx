"use client";

import { Button, Card, PageHeader, Spinner } from "@/components/ui";
import { AppSettings, primeSettings, useSettings } from "@/lib/useSettings";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR"];
const DATE_FORMATS = ["MMM D, YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

export default function SettingsPage() {
  const settings = useSettings();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isAdmin = me?.role === "ADMIN";
  const canEdit = Boolean(me && isAdmin);

  // Keep the form in sync with the shared settings cache (GET /api/settings)
  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    // Retry briefly on failure: on a cold dev start the first request can race the route compile
    let cancelled = false;
    const load = (attempt = 0) => {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setMe(d.user);
        })
        .catch(() => {
          if (!cancelled && attempt < 2) setTimeout(() => load(attempt + 1), 1000);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof AppSettings) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 403) {
        setError("Only administrators can change configuration");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      // Seed the shared cache so the whole app picks up the new settings on next render
      const next: AppSettings = { ...form, ...(data.settings || {}) };
      primeSettings(next);
      setForm(next);
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Configuration" subtitle="Organization name, currency and date display preferences" />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {saved ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Settings saved.</div> : null}
      {me && !isAdmin ? (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Only administrators can change configuration — these fields are read-only for your role.
        </div>
      ) : null}

      <Card className="max-w-2xl p-5">
        <div className="space-y-3">
          <div>
            <label className="label">Organization name</label>
            <input className="input" value={form.orgName} onChange={set("orgName")} disabled={!canEdit} placeholder="Property CRM" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={set("currency")} disabled={!canEdit}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date format</label>
              <select className="input" value={form.dateFormat} onChange={set("dateFormat")} disabled={!canEdit}>
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={saving || !canEdit}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : <Save size={15} />}
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
