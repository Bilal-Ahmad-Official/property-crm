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
import { Ban, Check, ChevronRight, ClipboardList, Clock, Eye, FileSignature, Pencil, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Booking = {
  id: string;
  ref: string;
  status: string;
  bookingAmount: number;
  depositAmount: number;
  bookingDate: string;
  expectedCloseDate?: string | null;
  notes?: string | null;
  reviewNote?: string | null;
  received: number;
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

type PaymentRow = {
  id: string;
  ref: string;
  direction: string;
  method: string;
  status: string;
  amount: number;
  paymentDate: string;
  notes?: string | null;
};

const EMPTY_FORM = {
  customerId: "",
  propertyId: "",
  bookingAmount: "",
  depositAmount: "",
  bookingDate: new Date().toISOString().slice(0, 10),
  expectedCloseDate: "",
  notes: "",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState({ total: 0, pendingReview: 0, approved: 0, completed: 0, bookedValue: 0, received: 0, outstanding: 0 });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ booking: Booking; history: HistoryEntry[]; payments: PaymentRow[]; received: number; outstanding: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decision, setDecision] = useState<{ booking: Booking; action: "approve" | "reject" | "return" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const canSubmit = (b: Booking) =>
    ["DRAFT", "RETURNED"].includes(b.status) &&
    Boolean(me && (["SALES", "MANAGER", "ADMIN"].includes(me.role) || b.createdBy?.id === me.id));
  const canApprove = (b: Booking) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(b.status) && Boolean(me && ["MANAGER", "ADMIN"].includes(me.role));
  const canEdit = (b: Booking) => ["DRAFT", "REJECTED", "RETURNED"].includes(b.status);
  const canCancel = (b: Booking) =>
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(b.status) &&
    Boolean(me && (b.createdBy?.id === me.id || me.role === "ADMIN"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bookings");
      setBookings(data.bookings);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
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
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(b: Booking) {
    setEditing(b);
    setForm({
      customerId: b.customer.id,
      propertyId: b.property.id,
      bookingAmount: String(b.bookingAmount),
      depositAmount: String(b.depositAmount),
      bookingDate: b.bookingDate ? new Date(b.bookingDate).toISOString().slice(0, 10) : "",
      expectedCloseDate: b.expectedCloseDate ? new Date(b.expectedCloseDate).toISOString().slice(0, 10) : "",
      notes: b.notes || "",
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
        bookingAmount: Number(form.bookingAmount || 0),
        depositAmount: Number(form.depositAmount || 0),
      };
      const res = await fetch(editing ? `/api/bookings/${editing.id}` : "/api/bookings", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save booking");
      setModalOpen(false);
      setError(null);
      setNotice(editing ? "Booking updated" : "Booking created");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save booking");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(b: Booking, action: string, reason = "") {
    try {
      const res = await fetch(`/api/bookings/${b.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setNotice(`Booking ${b.ref}: ${action.replace("_", " ")} done`);
      load();
      if (detail?.booking.id === b.id) openDetail(b.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/bookings/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load booking");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load booking");
    } finally {
      setDetailLoading(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/bookings/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete");
    } else {
      setNotice("Booking deleted");
    }
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="Reserve properties for customers and walk each booking through review and approval"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> New booking
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {notice && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total bookings" value={summary.total} hint={`${summary.approved} approved · ${summary.completed} completed`} icon={<FileSignature size={18} />} accent="brand" />
        <StatCard label="Pending review" value={summary.pendingReview} hint="Submitted or under review" icon={<Clock size={18} />} accent="amber" />
        <StatCard label="Received" value={formatCurrency(summary.received, true)} hint="Confirmed receipts against bookings" icon={<Check size={18} />} accent="emerald" />
        <StatCard label="Outstanding" value={formatCurrency(summary.outstanding, true)} hint={`${formatCurrency(summary.bookedValue, true)} booked value`} icon={<ClipboardList size={18} />} accent="violet" />
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
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<FileSignature size={36} />}
          title="No bookings found"
          hint="Create a booking to reserve a property for a customer, then submit it for approval."
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
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{b.ref}</td>
                    <td className="px-4 py-3">{b.customer.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{b.property.title}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(b.bookingAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-emerald-700">{formatCurrency(b.received)}</td>
                    <td className="px-4 py-3">
                      <Badge value={b.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(b.bookingDate)}</td>
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
                            <button onClick={() => setDecision({ booking: b, action: "approve" })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setDecision({ booking: b, action: "return" })} className="rounded-md p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600" title="Return for correction">
                              <Undo2 size={14} />
                            </button>
                            <button onClick={() => setDecision({ booking: b, action: "reject" })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Reject">
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {canCancel(b) ? (
                          <button onClick={() => setCancelTarget(b)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cancel booking">
                            <Ban size={14} />
                          </button>
                        ) : null}
                        {me?.role === "ADMIN" && ["DRAFT", "REJECTED", "CANCELLED"].includes(b.status) ? (
                          <button onClick={() => setDeleteTarget(b)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                            <Trash2 size={14} />
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit booking ${editing.ref}` : "New booking"} wide>
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
            <label className="label">Booking amount *</label>
            <input className="input" type="number" min="0" value={form.bookingAmount} onChange={set("bookingAmount")} />
          </div>
          <div>
            <label className="label">Deposit amount</label>
            <input className="input" type="number" min="0" value={form.depositAmount} onChange={set("depositAmount")} />
          </div>
          <div>
            <label className="label">Booking date</label>
            <input className="input" type="date" value={form.bookingDate} onChange={set("bookingDate")} />
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
        <p className="mt-3 text-xs text-slate-400">
          New bookings start as drafts. Submit them for manager/admin approval — approving reserves the property.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Create booking"}
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail ? `Booking ${detail.booking.ref}` : "Booking"} wide>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={detail.booking.status} />
              {detail.booking.reviewNote ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  Review note: {detail.booking.reviewNote}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Booking amount" value={formatCurrency(detail.booking.bookingAmount)} accent="brand" />
              <StatCard label="Received" value={formatCurrency(detail.received)} accent="emerald" />
              <StatCard label="Outstanding" value={formatCurrency(detail.outstanding)} accent="violet" />
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-500">Customer <span className="ml-2 font-medium text-slate-900">{detail.booking.customer.name}</span></p>
              <p className="text-slate-500">Property <span className="ml-2 font-medium text-slate-900">{detail.booking.property.title}</span></p>
              <p className="text-slate-500">Deposit <span className="ml-2 font-medium text-slate-900">{formatCurrency(detail.booking.depositAmount)}</span></p>
              <p className="text-slate-500">Booking date <span className="ml-2 font-medium text-slate-900">{formatDate(detail.booking.bookingDate)}</span></p>
              <p className="text-slate-500">Expected close <span className="ml-2 font-medium text-slate-900">{formatDate(detail.booking.expectedCloseDate)}</span></p>
              <p className="text-slate-500">Created by <span className="ml-2 font-medium text-slate-900">{detail.booking.createdBy?.name ?? "—"}</span></p>
              {detail.booking.notes ? <p className="text-slate-500 sm:col-span-2">Notes <span className="ml-2 font-medium text-slate-900">{detail.booking.notes}</span></p> : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Payments & receipts</h3>
                <span className="text-xs text-slate-400">{detail.payments.length} record{detail.payments.length === 1 ? "" : "s"}</span>
              </div>
              {detail.payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                  No payments recorded against this booking yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="font-mono text-xs text-slate-500">{p.ref}</span>
                          <Badge value={p.direction} />
                          <Badge value={p.method} />
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(p.paymentDate)}{p.notes ? ` · ${p.notes}` : ""}</p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-semibold">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <HistoryTimeline entries={detail.history} />
              </div>
            </div>

            {/* Lifecycle actions inside detail view */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {canSubmit(detail.booking) ? (
                <Button variant="secondary" onClick={() => runAction(detail.booking, "submit")}>
                  <Send size={14} /> Submit for approval
                </Button>
              ) : null}
              {canApprove(detail.booking) ? (
                <>
                  <Button variant="success" onClick={() => setDecision({ booking: detail.booking, action: "approve" })}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setDecision({ booking: detail.booking, action: "return" })}>
                    <Undo2 size={14} /> Return
                  </Button>
                  <Button variant="danger" onClick={() => setDecision({ booking: detail.booking, action: "reject" })}>
                    <X size={14} /> Reject
                  </Button>
                </>
              ) : null}
              {detail.booking.status === "APPROVED" ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  Finalized — generate the sale from the Sales module <ChevronRight size={12} />
                </span>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <DecisionDialog
        open={Boolean(decision)}
        action={decision?.action ?? "approve"}
        entityLabel={decision ? `booking ${decision.booking.ref}` : "booking"}
        onConfirm={(reason) => {
          if (decision) runAction(decision.booking, decision.action, reason);
          setDecision(null);
        }}
        onClose={() => setDecision(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel booking"
        message={`Cancel booking ${cancelTarget?.ref}? The property becomes bookable again.`}
        confirmLabel="Cancel booking"
        onConfirm={() => {
          if (cancelTarget) runAction(cancelTarget, "cancel");
          setCancelTarget(null);
        }}
        onClose={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete booking"
        message={`Permanently delete booking ${deleteTarget?.ref}? This cannot be undone.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
