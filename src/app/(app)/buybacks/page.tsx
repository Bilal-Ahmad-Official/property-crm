"use client";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DecisionDialog,
  EmptyState,
  HistoryTimeline,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";
import { formatCurrency, formatDate, formatDateTime, titleCase, TXN_STATUSES } from "@/lib/utils";
import { Ban, Check, ClipboardList, Clock, Eye, Pencil, Plus, Send, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type BuyBack = {
  id: string;
  ref: string;
  status: string;
  buybackAmount: number;
  buybackDate: string;
  reason?: string | null;
  notes?: string | null;
  reviewNote?: string | null;
  saleId?: string | null;
  customer: { id: string; name: string; ref?: string | null };
  property: { id: string; title: string; ref?: string | null; status?: string };
  createdBy?: { id: string; name: string } | null;
  reviewedBy?: { id: string; name: string } | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

type HistoryEntry = {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  user?: string | null;
  createdAt: string;
};

const EMPTY_FORM = {
  propertyId: "",
  customerId: "",
  saleId: "",
  buybackAmount: "",
  buybackDate: new Date().toISOString().slice(0, 10),
  reason: "",
  notes: "",
};

export default function BuyBacksPage() {
  const [buybacks, setBuyBacks] = useState<BuyBack[]>([]);
  const [summary, setSummary] = useState({ total: 0, pendingReview: 0, approved: 0, completed: 0, buybackValue: 0 });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null; status: string }[]>([]);
  const [sales, setSales] = useState<{ id: string; ref: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BuyBack | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ buyback: BuyBack; history: HistoryEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decision, setDecision] = useState<{ buyback: BuyBack; action: "approve" | "reject" | "return" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BuyBack | null>(null);

  const canSubmit = (b: BuyBack) =>
    ["DRAFT", "RETURNED"].includes(b.status) &&
    Boolean(me && (["SALES", "MANAGER", "ADMIN"].includes(me.role) || b.createdBy?.id === me.id));
  // Buy-backs are admin-approved (SRS §8 approval matrix)
  const canApprove = (b: BuyBack) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(b.status) && Boolean(me && me.role === "ADMIN");
  const canEdit = (b: BuyBack) => ["DRAFT", "REJECTED", "RETURNED"].includes(b.status);
  const canCancel = (b: BuyBack) =>
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(b.status) &&
    Boolean(me && (b.createdBy?.id === me.id || me.role === "ADMIN"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      const res = await fetch(`/api/buybacks?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load buy-backs");
      setBuyBacks(data.buybacks);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load buy-backs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user)).catch(() => {});
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(d.contacts || [])).catch(() => {});
    // Buy-backs typically target sold properties, so don't filter the select by status
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setProperties(d.properties || []))
      .catch(() => {});
    // The Sales module may not exist yet — hide the sale select when its API is unavailable
    fetch("/api/sales")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSales(d?.sales || []))
      .catch(() => setSales([]));
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(b: BuyBack) {
    setEditing(b);
    setForm({
      propertyId: b.property.id,
      customerId: b.customer.id,
      saleId: b.saleId || "",
      buybackAmount: String(b.buybackAmount),
      buybackDate: b.buybackDate ? new Date(b.buybackDate).toISOString().slice(0, 10) : "",
      reason: b.reason || "",
      notes: b.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.propertyId || !form.customerId) {
      setError("Property and customer are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        buybackAmount: Number(form.buybackAmount || 0),
      };
      const res = await fetch(editing ? `/api/buybacks/${editing.id}` : "/api/buybacks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save buy-back");
      setModalOpen(false);
      setError(null);
      setNotice(editing ? "Buy-back updated" : "Buy-back created");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save buy-back");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(b: BuyBack, action: string, reason = "") {
    try {
      const res = await fetch(`/api/buybacks/${b.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setNotice(`Buy-back ${b.ref}: ${action.replace("_", " ")} done`);
      load();
      if (detail?.buyback.id === b.id) openDetail(b.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/buybacks/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load buy-back");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load buy-back");
    } finally {
      setDetailLoading(false);
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Buy-backs"
        subtitle="Buy properties back from customers and return them to inventory through review and approval"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> New buy-back
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {notice && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total buy-backs" value={summary.total} hint={`${summary.approved} approved · ${summary.completed} completed`} icon={<Undo2 size={18} />} accent="brand" />
        <StatCard label="Pending review" value={summary.pendingReview} hint="Submitted or under review" icon={<Clock size={18} />} accent="amber" />
        <StatCard label="Buy-back value" value={formatCurrency(summary.buybackValue, true)} hint="Across open buy-backs" icon={<ClipboardList size={18} />} accent="emerald" />
        <StatCard label="Completed" value={summary.completed} hint="Approved and settled" icon={<Check size={18} />} accent="violet" />
      </div>

      {/* Filters */}
      <Card className="mb-4 mt-6 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search ref, customer, property…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select className="input sm:w-44" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {TXN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : buybacks.length === 0 ? (
        <EmptyState
          icon={<Undo2 size={36} />}
          title="No buy-backs found"
          hint="Create a buy-back to purchase a property back from a customer, then submit it for approval."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Ref</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Buy-back amount</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buybacks.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{b.ref}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{b.property.title}</span>
                    </td>
                    <td className="px-4 py-3">{b.customer.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(b.buybackAmount)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{b.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge value={b.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(b.buybackDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openDetail(b.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View details">
                          <Eye size={14} />
                        </button>
                        {canEdit(b) ? (
                          <button onClick={() => openEdit(b)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {canSubmit(b) ? (
                          <button onClick={() => runAction(b, "submit")} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Submit for approval">
                            <Send size={14} />
                          </button>
                        ) : null}
                        {canApprove(b) ? (
                          <>
                            <button onClick={() => setDecision({ buyback: b, action: "approve" })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setDecision({ buyback: b, action: "return" })} className="rounded-md p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600" title="Return for correction">
                              <Undo2 size={14} />
                            </button>
                            <button onClick={() => setDecision({ buyback: b, action: "reject" })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Reject">
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {canCancel(b) ? (
                          <button onClick={() => setCancelTarget(b)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cancel buy-back">
                            <Ban size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit buy-back ${editing.ref}` : "New buy-back"} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Property *</label>
            <select className="input" value={form.propertyId} onChange={set("propertyId")}>
              <option value="">Select property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({titleCase(p.status)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Customer *</label>
            <select className="input" value={form.customerId} onChange={set("customerId")}>
              <option value="">Select customer…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {sales.length > 0 ? (
            <div>
              <label className="label">Originating sale</label>
              <select className="input" value={form.saleId} onChange={set("saleId")}>
                <option value="">None</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>{s.ref}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="label">Buy-back amount *</label>
            <input className="input" type="number" min="0" value={form.buybackAmount} onChange={set("buybackAmount")} />
          </div>
          <div>
            <label className="label">Buy-back date</label>
            <input className="input" type="date" value={form.buybackDate} onChange={set("buybackDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Reason</label>
            <textarea className="input" rows={2} value={form.reason} onChange={set("reason")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          New buy-backs start as drafts. Submit them for administrator approval — approving returns a sold property to inventory.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Create buy-back"}
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail ? `Buy-back ${detail.buyback.ref}` : "Buy-back"} wide>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={detail.buyback.status} />
              {detail.buyback.reviewNote ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  Review note: {detail.buyback.reviewNote}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Buy-back amount" value={formatCurrency(detail.buyback.buybackAmount)} accent="brand" />
              <StatCard label="Property status" value={titleCase(detail.buyback.property.status ?? "")} accent="violet" />
              <StatCard label="Buy-back date" value={formatDate(detail.buyback.buybackDate)} accent="emerald" />
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-500">Customer <span className="ml-2 font-medium text-slate-900">{detail.buyback.customer.name}</span></p>
              <p className="text-slate-500">Property <span className="ml-2 font-medium text-slate-900">{detail.buyback.property.title}</span></p>
              <p className="text-slate-500">Created by <span className="ml-2 font-medium text-slate-900">{detail.buyback.createdBy?.name ?? "—"}</span></p>
              <p className="text-slate-500">Submitted <span className="ml-2 font-medium text-slate-900">{formatDateTime(detail.buyback.submittedAt)}</span></p>
              {detail.buyback.reason ? <p className="text-slate-500 sm:col-span-2">Reason <span className="ml-2 font-medium text-slate-900">{detail.buyback.reason}</span></p> : null}
              {detail.buyback.notes ? <p className="text-slate-500 sm:col-span-2">Notes <span className="ml-2 font-medium text-slate-900">{detail.buyback.notes}</span></p> : null}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <HistoryTimeline entries={detail.history} />
              </div>
            </div>

            {/* Lifecycle actions inside detail view */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {canSubmit(detail.buyback) ? (
                <Button variant="secondary" onClick={() => runAction(detail.buyback, "submit")}>
                  <Send size={14} /> Submit for approval
                </Button>
              ) : null}
              {canApprove(detail.buyback) ? (
                <>
                  <Button variant="success" onClick={() => setDecision({ buyback: detail.buyback, action: "approve" })}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setDecision({ buyback: detail.buyback, action: "return" })}>
                    <Undo2 size={14} /> Return
                  </Button>
                  <Button variant="danger" onClick={() => setDecision({ buyback: detail.buyback, action: "reject" })}>
                    <X size={14} /> Reject
                  </Button>
                </>
              ) : null}
              {detail.buyback.status === "APPROVED" ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  Finalized — the property has been returned to inventory
                </span>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <DecisionDialog
        open={Boolean(decision)}
        action={decision?.action ?? "approve"}
        entityLabel={decision ? `buy-back ${decision.buyback.ref}` : "buy-back"}
        onConfirm={(reason) => {
          if (decision) runAction(decision.buyback, decision.action, reason);
          setDecision(null);
        }}
        onClose={() => setDecision(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel buy-back"
        message={`Cancel buy-back ${cancelTarget?.ref}? This withdraws the request.`}
        confirmLabel="Cancel buy-back"
        onConfirm={() => {
          if (cancelTarget) runAction(cancelTarget, "cancel");
          setCancelTarget(null);
        }}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
