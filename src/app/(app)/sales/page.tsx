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
import { formatCurrency, formatDate, titleCase, TXN_STATUSES } from "@/lib/utils";
import { Ban, Check, ChevronRight, Clock, DollarSign, Eye, HandCoins, Pencil, Percent, Plus, Send, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Sale = {
  id: string;
  ref: string;
  status: string;
  saleAmount: number;
  discountAmount: number;
  commission: number;
  saleDate: string;
  notes?: string | null;
  reviewNote?: string | null;
  customer: { id: string; name: string; ref?: string | null };
  property: { id: string; title: string; ref?: string | null; status?: string };
  agent?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  reviewedBy?: { id: string; name: string } | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  bookingId?: string | null;
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
  customerId: "",
  propertyId: "",
  bookingId: "",
  agentId: "",
  saleAmount: "",
  discountAmount: "",
  commission: "",
  saleDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState({ total: 0, pendingReview: 0, approved: 0, completed: 0, saleValue: 0, commission: 0 });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null; status: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [bookings, setBookings] = useState<{ id: string; ref: string; customer: { name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ sale: Sale; history: HistoryEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decision, setDecision] = useState<{ sale: Sale; action: "approve" | "reject" | "return" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);

  const canSubmit = (s: Sale) =>
    ["DRAFT", "RETURNED"].includes(s.status) &&
    Boolean(me && (["SALES", "MANAGER", "ADMIN"].includes(me.role) || s.createdBy?.id === me.id));
  const canApprove = (s: Sale) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(s.status) && Boolean(me && ["MANAGER", "ADMIN"].includes(me.role));
  const canEdit = (s: Sale) => ["DRAFT", "REJECTED", "RETURNED"].includes(s.status);
  const canCancel = (s: Sale) =>
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(s.status) &&
    Boolean(me && (s.createdBy?.id === me.id || me.role === "ADMIN"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      const res = await fetch(`/api/sales?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sales");
      setSales(data.sales);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales");
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
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setProperties((d.properties || []).filter((p: { status: string }) => !["SOLD", "INACTIVE"].includes(p.status))))
      .catch(() => {});
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users || [])).catch(() => {});
    fetch("/api/bookings").then((r) => r.json()).then((d) => setBookings(d.bookings || [])).catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(s: Sale) {
    setEditing(s);
    setForm({
      customerId: s.customer.id,
      propertyId: s.property.id,
      bookingId: s.bookingId || "",
      agentId: s.agent?.id || "",
      saleAmount: String(s.saleAmount),
      discountAmount: String(s.discountAmount),
      commission: String(s.commission),
      saleDate: s.saleDate ? new Date(s.saleDate).toISOString().slice(0, 10) : "",
      notes: s.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.customerId || !form.propertyId) {
      setError("Customer and property are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        saleAmount: Number(form.saleAmount || 0),
        discountAmount: Number(form.discountAmount || 0),
        commission: Number(form.commission || 0),
      };
      const res = await fetch(editing ? `/api/sales/${editing.id}` : "/api/sales", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save sale");
      setModalOpen(false);
      setError(null);
      setNotice(editing ? "Sale updated" : "Sale created");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save sale");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(s: Sale, action: string, reason = "") {
    try {
      const res = await fetch(`/api/sales/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setNotice(`Sale ${s.ref}: ${action.replace("_", " ")} done`);
      load();
      if (detail?.sale.id === s.id) openDetail(s.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/sales/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sale");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sale");
    } finally {
      setDetailLoading(false);
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Record property sales for customers and walk each sale through review and approval"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> New sale
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {notice && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={summary.total} hint={`${summary.approved} approved · ${summary.completed} completed`} icon={<HandCoins size={18} />} accent="brand" />
        <StatCard label="Pending review" value={summary.pendingReview} hint="Submitted or under review" icon={<Clock size={18} />} accent="amber" />
        <StatCard label="Sale value" value={formatCurrency(summary.saleValue, true)} hint="Open sales from draft to approved" icon={<DollarSign size={18} />} accent="emerald" />
        <StatCard label="Commission" value={formatCurrency(summary.commission, true)} hint={`${formatCurrency(summary.saleValue, true)} open sale value`} icon={<Percent size={18} />} accent="violet" />
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
      ) : sales.length === 0 ? (
        <EmptyState
          icon={<HandCoins size={36} />}
          title="No sales found"
          hint="Record a sale against a property for a customer, then submit it for approval."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Ref</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Discount</th>
                  <th className="px-4 py-3 font-semibold">Commission</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{s.ref}</td>
                    <td className="px-4 py-3">{s.customer.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{s.property.title}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.agent?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(s.saleAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatCurrency(s.discountAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-emerald-700">{formatCurrency(s.commission)}</td>
                    <td className="px-4 py-3">
                      <Badge value={s.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(s.saleDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openDetail(s.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View details">
                          <Eye size={14} />
                        </button>
                        {canEdit(s) ? (
                          <button onClick={() => openEdit(s)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {canSubmit(s) ? (
                          <button onClick={() => runAction(s, "submit")} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Submit for approval">
                            <Send size={14} />
                          </button>
                        ) : null}
                        {canApprove(s) ? (
                          <>
                            <button onClick={() => setDecision({ sale: s, action: "approve" })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setDecision({ sale: s, action: "return" })} className="rounded-md p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600" title="Return for correction">
                              <Undo2 size={14} />
                            </button>
                            <button onClick={() => setDecision({ sale: s, action: "reject" })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Reject">
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {canCancel(s) ? (
                          <button onClick={() => setCancelTarget(s)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cancel sale">
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit sale ${editing.ref}` : "New sale"} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Customer *</label>
            <select className="input" value={form.customerId} onChange={set("customerId")}>
              <option value="">Select customer…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
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
            <label className="label">Originating booking</label>
            <select className="input" value={form.bookingId} onChange={set("bookingId")}>
              <option value="">None</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>{b.ref} · {b.customer.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Agent</label>
            <select className="input" value={form.agentId} onChange={set("agentId")}>
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sale amount *</label>
            <input className="input" type="number" min="0" value={form.saleAmount} onChange={set("saleAmount")} />
          </div>
          <div>
            <label className="label">Discount amount</label>
            <input className="input" type="number" min="0" value={form.discountAmount} onChange={set("discountAmount")} />
          </div>
          <div>
            <label className="label">Commission</label>
            <input className="input" type="number" min="0" value={form.commission} onChange={set("commission")} />
          </div>
          <div>
            <label className="label">Sale date</label>
            <input className="input" type="date" value={form.saleDate} onChange={set("saleDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          New sales start as drafts. Submit them for manager/admin approval — approving marks the property as sold.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Create sale"}
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail ? `Sale ${detail.sale.ref}` : "Sale"} wide>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={detail.sale.status} />
              {detail.sale.reviewNote ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  Review note: {detail.sale.reviewNote}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Sale amount" value={formatCurrency(detail.sale.saleAmount)} accent="brand" />
              <StatCard label="Discount" value={formatCurrency(detail.sale.discountAmount)} accent="amber" />
              <StatCard label="Commission" value={formatCurrency(detail.sale.commission)} accent="violet" />
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-500">Customer <span className="ml-2 font-medium text-slate-900">{detail.sale.customer.name}</span></p>
              <p className="text-slate-500">Property <span className="ml-2 font-medium text-slate-900">{detail.sale.property.title}</span></p>
              <p className="text-slate-500">Agent <span className="ml-2 font-medium text-slate-900">{detail.sale.agent?.name ?? "—"}</span></p>
              <p className="text-slate-500">Sale date <span className="ml-2 font-medium text-slate-900">{formatDate(detail.sale.saleDate)}</span></p>
              <p className="text-slate-500">Created by <span className="ml-2 font-medium text-slate-900">{detail.sale.createdBy?.name ?? "—"}</span></p>
              <p className="text-slate-500">Created <span className="ml-2 font-medium text-slate-900">{formatDate(detail.sale.createdAt)}</span></p>
              {detail.sale.notes ? <p className="text-slate-500 sm:col-span-2">Notes <span className="ml-2 font-medium text-slate-900">{detail.sale.notes}</span></p> : null}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <HistoryTimeline entries={detail.history} />
              </div>
            </div>

            {/* Lifecycle actions inside detail view */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {canSubmit(detail.sale) ? (
                <Button variant="secondary" onClick={() => runAction(detail.sale, "submit")}>
                  <Send size={14} /> Submit for approval
                </Button>
              ) : null}
              {canApprove(detail.sale) ? (
                <>
                  <Button variant="success" onClick={() => setDecision({ sale: detail.sale, action: "approve" })}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setDecision({ sale: detail.sale, action: "return" })}>
                    <Undo2 size={14} /> Return
                  </Button>
                  <Button variant="danger" onClick={() => setDecision({ sale: detail.sale, action: "reject" })}>
                    <X size={14} /> Reject
                  </Button>
                </>
              ) : null}
              {detail.sale.status === "APPROVED" ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  Finalized — the property is marked as sold <ChevronRight size={12} />
                </span>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <DecisionDialog
        open={Boolean(decision)}
        action={decision?.action ?? "approve"}
        entityLabel={decision ? `sale ${decision.sale.ref}` : "sale"}
        onConfirm={(reason) => {
          if (decision) runAction(decision.sale, decision.action, reason);
          setDecision(null);
        }}
        onClose={() => setDecision(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel sale"
        message={`Cancel sale ${cancelTarget?.ref}? The property becomes available for a new sale.`}
        confirmLabel="Cancel sale"
        onConfirm={() => {
          if (cancelTarget) runAction(cancelTarget, "cancel");
          setCancelTarget(null);
        }}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
