"use client";

import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { cn, formatCurrency, formatDate, LEAD_SOURCES, LEAD_STATUSES, titleCase } from "@/lib/utils";
import { ChevronRight, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source: string;
  status: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  interest?: string | null;
  notes?: string | null;
  score: number;
  property?: { id: string; title: string } | null;
  assignedTo?: { id: string; name: string } | null;
  createdAt: string;
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  source: "WEBSITE",
  status: "NEW",
  budgetMin: "",
  budgetMax: "",
  interest: "",
  notes: "",
  propertyId: "",
  assignedToId: "",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leads");
      setLeads(data.leads);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setProperties(d.properties || []))
      .catch(() => {});
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(l: Lead) {
    setEditing(l);
    setForm({
      name: l.name,
      email: l.email || "",
      phone: l.phone || "",
      source: l.source,
      status: l.status,
      budgetMin: l.budgetMin != null ? String(l.budgetMin) : "",
      budgetMax: l.budgetMax != null ? String(l.budgetMax) : "",
      interest: l.interest || "",
      notes: l.notes || "",
      propertyId: l.property?.id || "",
      assignedToId: l.assignedTo?.id || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        budgetMin: form.budgetMin === "" ? null : Number(form.budgetMin),
        budgetMax: form.budgetMax === "" ? null : Number(form.budgetMax),
        propertyId: form.propertyId || null,
        assignedToId: form.assignedToId || null,
      };
      const res = await fetch(editing ? `/api/leads/${editing.id}` : "/api/leads", {
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

  async function changeStatus(lead: Lead, status: string) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove() {
    if (!deleteTarget) return;
    await fetch(`/api/leads/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function budgetText(l: Lead) {
    if (l.budgetMin && l.budgetMax) return `${formatCurrency(l.budgetMin, true)} – ${formatCurrency(l.budgetMax, true)}`;
    if (l.budgetMax) return `up to ${formatCurrency(l.budgetMax, true)}`;
    if (l.budgetMin) return `from ${formatCurrency(l.budgetMin, true)}`;
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} lead${leads.length === 1 ? "" : "s"} — drag pipeline forward to close`}
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add lead
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
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
      ) : leads.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="No leads found" hint="Add a lead or ask Aria to summarize your pipeline." />
      ) : view === "pipeline" ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {LEAD_STATUSES.map((status) => {
            const columnLeads = leads.filter((l) => l.status === status);
            return (
              <div key={status} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm border border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{titleCase(status)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {columnLeads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnLeads.map((l) => (
                    <Card key={l.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{l.name}</p>
                          <p className="truncate text-xs text-slate-500">{l.interest || "No interest noted"}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                          {l.score}
                        </span>
                      </div>
                      {budgetText(l) ? <p className="mt-1.5 text-xs font-medium text-slate-700">{budgetText(l)}</p> : null}
                      {l.property ? (
                        <Link
                          href={`/properties/${l.property.id}`}
                          className="mt-1 block truncate text-xs text-brand-600 hover:underline"
                          title={l.property.title}
                        >
                          ↔ {l.property.title}
                        </Link>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                        <Badge value={l.source} />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(l)}
                            className="rounded-md p-1 text-[11px] font-medium text-slate-400 hover:text-brand-600"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => setDeleteTarget(l)}
                            className="rounded-md p-1 text-[11px] text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <select
                          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
                          value={l.status}
                          onChange={(e) => changeStatus(l, e.target.value)}
                          title="Move to stage"
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>{titleCase(s)}</option>
                          ))}
                        </select>
                        <ChevronRight size={14} className="shrink-0 text-slate-300" />
                      </div>
                    </Card>
                  ))}
                  {columnLeads.length === 0 ? (
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
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Budget</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Added</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.email || l.phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                        value={l.status}
                        onChange={(e) => changeStatus(l, e.target.value)}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>{titleCase(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={l.source} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{budgetText(l) ?? "—"}</td>
                    <td className="max-w-44 truncate px-4 py-3">
                      {l.property ? (
                        <Link href={`/properties/${l.property.id}`} className="text-brand-600 hover:underline">
                          {l.property.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{l.assignedTo?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(l.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(l)} className="rounded-md p-1.5 text-slate-400 hover:text-brand-600" title="Edit">
                        ✎
                      </button>
                      <button onClick={() => setDeleteTarget(l)} className="rounded-md p-1.5 text-slate-400 hover:text-red-600" title="Delete">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit lead" : "Add lead"} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={form.source} onChange={set("source")}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assigned agent</label>
            <select className="input" value={form.assignedToId} onChange={set("assignedToId")}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Budget min (USD)</label>
            <input className="input" type="number" min="0" value={form.budgetMin} onChange={set("budgetMin")} />
          </div>
          <div>
            <label className="label">Budget max (USD)</label>
            <input className="input" type="number" min="0" value={form.budgetMax} onChange={set("budgetMax")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Looking for</label>
            <input className="input" value={form.interest} onChange={set("interest")} placeholder="e.g. 3-bed apartment near schools" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Interested property</label>
            <select className="input" value={form.propertyId} onChange={set("propertyId")}>
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
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
            {editing ? "Save changes" : "Add lead"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete lead"
        message={`Delete lead “${deleteTarget?.name}”? Linked deals will be detached but not deleted.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
