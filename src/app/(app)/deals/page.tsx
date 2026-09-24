"use client";

import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { cn, DEAL_STAGES, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { Handshake, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Deal = {
  id: string;
  title: string;
  value: number;
  commission: number;
  stage: string;
  type: string;
  notes?: string | null;
  expectedCloseDate?: string | null;
  closedAt?: string | null;
  property?: { id: string; title: string } | null;
  contact?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
  createdAt: string;
};

const EMPTY_FORM = {
  title: "",
  value: "",
  commission: "",
  stage: "OFFER_MADE",
  type: "SALE",
  propertyId: "",
  contactId: "",
  ownerId: "",
  expectedCloseDate: "",
  notes: "",
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [summary, setSummary] = useState({ openCount: 0, openValue: 0, openCommission: 0, wonCount: 0, wonValue: 0, wonCommission: 0 });
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deals");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load deals");
      setDeals(data.deals);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then((d) => setProperties(d.properties || [])).catch(() => {});
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(d.contacts || [])).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users || [])).catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(d: Deal) {
    setEditing(d);
    setForm({
      title: d.title,
      value: String(d.value),
      commission: String(d.commission),
      stage: d.stage,
      type: d.type,
      propertyId: d.property?.id || "",
      contactId: d.contact?.id || "",
      ownerId: d.owner?.id || "",
      expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : "",
      notes: d.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        value: Number(form.value || 0),
        commission: Number(form.commission || 0),
        propertyId: form.propertyId || null,
        contactId: form.contactId || null,
        ownerId: form.ownerId || null,
        expectedCloseDate: form.expectedCloseDate || null,
      };
      const res = await fetch(editing ? `/api/deals/${editing.id}` : "/api/deals", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setModalOpen(false);
      setError(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(deal: Deal, stage: string) {
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  async function remove() {
    if (!deleteTarget) return;
    await fetch(`/api/deals/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle={`${summary.openCount} open · ${formatCurrency(summary.openValue, true)} pipeline · ${formatCurrency(summary.openCommission, true)} commission`}
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add deal
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Open pipeline", value: formatCurrency(summary.openValue, true) },
          { label: "Open commission", value: formatCurrency(summary.openCommission, true) },
          { label: "Won this year", value: formatCurrency(summary.wonValue, true) },
          { label: "Won commission (YTD)", value: formatCurrency(summary.wonCommission, true) },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-lg font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 flex items-center justify-end p-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          <button
            onClick={() => setView("pipeline")}
            className={cn("px-3 py-2 text-xs font-medium text-slate-500 transition", view === "pipeline" && "bg-brand-600 text-white")}
          >
            Pipeline
          </button>
          <button
            onClick={() => setView("table")}
            className={cn("px-3 py-2 text-xs font-medium text-slate-500 transition", view === "table" && "bg-brand-600 text-white")}
          >
            Table
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : deals.length === 0 ? (
        <EmptyState icon={<Handshake size={36} />} title="No deals found" hint="Create your first deal from a lead or from scratch." />
      ) : view === "pipeline" ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {DEAL_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            const value = stageDeals.reduce((s, d) => s + d.value, 0);
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{titleCase(stage)}</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {formatCurrency(value, true)}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageDeals.map((d) => (
                    <Card key={d.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{d.title}</p>
                          <p className="text-xs text-slate-500">{d.property?.title ?? d.contact?.name ?? "—"}</p>
                        </div>
                        <Badge value={d.type} />
                      </div>
                      <p className="mt-2 text-sm font-bold text-brand-700">{formatCurrency(d.value)}</p>
                      <p className="text-xs text-slate-500">Commission {formatCurrency(d.commission)}</p>
                      {d.expectedCloseDate ? (
                        <p className="mt-1 text-xs text-slate-500">Target close: {formatDate(d.expectedCloseDate)}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                        <span className="truncate text-[11px] text-slate-400">{d.owner?.name ?? "Unassigned"}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(d)} className="rounded-md p-1 text-[11px] text-slate-400 hover:text-brand-600" title="Edit">
                            ✎
                          </button>
                          <button onClick={() => setDeleteTarget(d)} className="rounded-md p-1 text-slate-400 hover:text-red-600" title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <select
                        className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
                        value={d.stage}
                        onChange={(e) => changeStage(d, e.target.value)}
                        title="Move to stage"
                      >
                        {DEAL_STAGES.map((s) => (
                          <option key={s} value={s}>{titleCase(s)}</option>
                        ))}
                      </select>
                    </Card>
                  ))}
                  {stageDeals.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                      Empty
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Deal</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Value</th>
                  <th className="px-4 py-3 font-semibold">Commission</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Target close</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium">{d.title}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                        value={d.stage}
                        onChange={(e) => changeStage(d, e.target.value)}
                      >
                        {DEAL_STAGES.map((s) => (
                          <option key={s} value={s}>{titleCase(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(d.value)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatCurrency(d.commission)}</td>
                    <td className="max-w-44 truncate px-4 py-3">
                      {d.property ? (
                        <Link href={`/properties/${d.property.id}`} className="text-brand-600 hover:underline">
                          {d.property.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{d.contact?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(d.expectedCloseDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(d)} className="rounded-md p-1.5 text-slate-400 hover:text-brand-600" title="Edit">
                        ✎
                      </button>
                      <button onClick={() => setDeleteTarget(d)} className="rounded-md p-1.5 text-slate-400 hover:text-red-600" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit deal" : "Add deal"} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Palm Grove House — Sale" />
          </div>
          <div>
            <label className="label">Deal value (USD) *</label>
            <input className="input" type="number" min="0" value={form.value} onChange={set("value")} />
          </div>
          <div>
            <label className="label">Commission (USD)</label>
            <input className="input" type="number" min="0" value={form.commission} onChange={set("commission")} />
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={form.stage} onChange={set("stage")}>
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={set("type")}>
              <option value="SALE">Sale</option>
              <option value="RENT">Rent</option>
            </select>
          </div>
          <div>
            <label className="label">Property</label>
            <select className="input" value={form.propertyId} onChange={set("propertyId")}>
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={form.contactId} onChange={set("contactId")}>
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Deal owner</label>
            <select className="input" value={form.ownerId} onChange={set("ownerId")}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Expected close date</label>
            <input className="input" type="date" value={form.expectedCloseDate} onChange={set("expectedCloseDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Add deal"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete deal"
        message={`Delete deal “${deleteTarget?.title}”? This cannot be undone.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
