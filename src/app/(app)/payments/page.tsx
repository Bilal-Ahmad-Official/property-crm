"use client";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  HistoryTimeline,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";
import { PAYMENT_DIRECTIONS, PAYMENT_METHODS, PAYMENT_STATUSES, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Ban, Check, Eye, Plus, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Payment = {
  id: string;
  ref: string;
  direction: string;
  method: string;
  status: string;
  amount: number;
  paymentDate: string;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedRef?: string | null;
  notes?: string | null;
  customer: { id: string; name: string; ref?: string | null } | null;
  property: { id: string; title: string; ref?: string | null } | null;
  createdBy?: { id: string; name: string } | null;
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

// Related transaction modules for the picker (SRS §7) — each exposes a list API
const RELATED_MODULES: { type: string; api: string; key: string }[] = [
  { type: "BOOKING", api: "/api/bookings", key: "bookings" },
  { type: "SALE", api: "/api/sales", key: "sales" },
  { type: "PURCHASE", api: "/api/purchases", key: "purchases" },
  { type: "TRANSFER", api: "/api/transfers", key: "transfers" },
  { type: "BUYBACK", api: "/api/buybacks", key: "buybacks" },
  { type: "CHARGE", api: "/api/charges", key: "charges" },
];

type RelatedRecord = {
  id: string;
  ref: string;
  title?: string | null;
  amount?: number;
  bookingAmount?: number;
  saleAmount?: number;
  purchaseAmount?: number;
  transferFee?: number;
  buybackAmount?: number;
};

function relatedLabel(r: RelatedRecord): string {
  const amount = r.amount ?? r.bookingAmount ?? r.saleAmount ?? r.purchaseAmount ?? r.transferFee ?? r.buybackAmount;
  if (r.title) return `${r.ref} — ${r.title}${amount !== undefined ? ` (${formatCurrency(amount)})` : ""}`;
  return `${r.ref}${amount !== undefined ? ` (${formatCurrency(amount)})` : ""}`;
}

const EMPTY_FORM = {
  relatedType: "",
  relatedId: "",
  relatedRef: "",
  customerId: "",
  propertyId: "",
  amount: "",
  direction: "RECEIPT",
  method: "BANK_TRANSFER",
  status: "CONFIRMED",
  paymentDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState({ total: 0, totalReceived: 0, totalPaid: 0, net: 0 });
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null }[]>([]);
  const [relatedRecords, setRelatedRecords] = useState<RelatedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", direction: "", status: "", relatedType: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ payment: Payment; history: HistoryEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.direction) params.set("direction", filters.direction);
      if (filters.status) params.set("status", filters.status);
      if (filters.relatedType) params.set("relatedType", filters.relatedType);
      const res = await fetch(`/api/payments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      setPayments(data.payments);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(d.contacts || [])).catch(() => {});
    fetch("/api/properties").then((r) => r.json()).then((d) => setProperties(d.properties || [])).catch(() => {});
  }, []);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setRelatedRecords([]);
    setModalOpen(true);
  }

  function chooseRelatedType(type: string) {
    setForm((f) => ({ ...f, relatedType: type, relatedId: "", relatedRef: "" }));
    setRelatedRecords([]);
    if (!type) return;
    const mod = RELATED_MODULES.find((m) => m.type === type);
    if (!mod) return;
    fetch(mod.api)
      .then((r) => r.json())
      .then((d) => setRelatedRecords((d[mod.key] || []) as RelatedRecord[]))
      .catch(() => {});
  }

  function chooseRelatedRecord(id: string) {
    const record = relatedRecords.find((r) => r.id === id);
    setForm((f) => ({ ...f, relatedId: id, relatedRef: record?.ref ?? "" }));
  }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount || 0),
      };
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      setModalOpen(false);
      setError(null);
      setNotice("Payment recorded");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(p: Payment, action: string) {
    try {
      const res = await fetch(`/api/payments/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setNotice(`Payment ${p.ref}: ${action === "confirm" ? "confirmed" : "cancelled"}`);
      load();
      if (detail?.payment.id === p.id) openDetail(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/payments/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payment");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payment");
    } finally {
      setDetailLoading(false);
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Payments & receipts"
        subtitle="Record payments and receipts against transactions and keep track of cash in versus cash out"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> New payment
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {notice && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Received" value={formatCurrency(summary.totalReceived, true)} hint="Confirmed receipts" icon={<ArrowDownLeft size={18} />} accent="emerald" />
        <StatCard label="Paid" value={formatCurrency(summary.totalPaid, true)} hint="Confirmed payments out" icon={<ArrowUpRight size={18} />} accent="amber" />
        <StatCard label="Net" value={formatCurrency(summary.net, true)} hint={`${summary.total} record${summary.total === 1 ? "" : "s"} overall`} icon={<Wallet size={18} />} accent="brand" />
      </div>

      {/* Filters */}
      <Card className="mb-4 mt-6 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search ref, related ref, customer…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select className="input sm:w-40" value={filters.direction} onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}>
          <option value="">All directions</option>
          {PAYMENT_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {titleCase(d)}
            </option>
          ))}
        </select>
        <select className="input sm:w-40" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
        <select className="input sm:w-44" value={filters.relatedType} onChange={(e) => setFilters((f) => ({ ...f, relatedType: e.target.value }))}>
          <option value="">All related types</option>
          {RELATED_MODULES.map((m) => (
            <option key={m.type} value={m.type}>
              {titleCase(m.type)}
            </option>
          ))}
        </select>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<Wallet size={36} />}
          title="No payments found"
          hint="Record a payment or receipt against a booking, sale or charge to track cash flow."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Ref</th>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Related</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{p.ref}</td>
                    <td className="px-4 py-3">
                      <Badge value={p.direction} />
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${p.direction === "RECEIPT" ? "text-emerald-700" : "text-orange-600"}`}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={p.method} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={p.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {p.relatedRef ? (
                        <span className="text-xs">
                          <span className="text-slate-400">{titleCase(p.relatedType ?? "")} </span>
                          <span className="font-mono font-medium">{p.relatedRef}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{p.customer?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openDetail(p.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View details">
                          <Eye size={14} />
                        </button>
                        {p.status === "PENDING" ? (
                          <button onClick={() => setConfirmTarget(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Confirm payment">
                            <Check size={14} />
                          </button>
                        ) : null}
                        {p.status !== "CANCELLED" ? (
                          <button onClick={() => setCancelTarget(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cancel payment">
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

      {/* New payment modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New payment" wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Related to</label>
            <select className="input" value={form.relatedType} onChange={(e) => chooseRelatedType(e.target.value)}>
              <option value="">None — standalone payment</option>
              {RELATED_MODULES.map((m) => (
                <option key={m.type} value={m.type}>{titleCase(m.type)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Related record</label>
            <select className="input" value={form.relatedId} onChange={(e) => chooseRelatedRecord(e.target.value)} disabled={!form.relatedType}>
              <option value="">{form.relatedType ? "Select record…" : "—"}</option>
              {relatedRecords.map((r) => (
                <option key={r.id} value={r.id}>{relatedLabel(r)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={form.customerId} onChange={set("customerId")}>
              <option value="">Select customer…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Property</label>
            <select className="input" value={form.propertyId} onChange={set("propertyId")}>
              <option value="">Select property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount *</label>
            <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} />
          </div>
          <div>
            <label className="label">Direction</label>
            <select className="input" value={form.direction} onChange={set("direction")}>
              {PAYMENT_DIRECTIONS.map((d) => (
                <option key={d} value={d}>{titleCase(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={form.method} onChange={set("method")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{titleCase(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment date</label>
            <input className="input" type="date" value={form.paymentDate} onChange={set("paymentDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        {form.relatedRef ? (
          <p className="mt-3 text-xs text-slate-400">
            Linked to {titleCase(form.relatedType)} <span className="font-mono">{form.relatedRef}</span>
          </p>
        ) : null}
        <p className="mt-3 text-xs text-slate-400">
          Payments can be recorded by any signed-in user. Confirming finalizes the amount — cancelling reverses it.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            Record payment
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail ? `Payment ${detail.payment.ref}` : "Payment"}>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={detail.payment.direction} />
              <Badge value={detail.payment.method} />
              <Badge value={detail.payment.status} />
            </div>

            <StatCard
              label="Amount"
              value={formatCurrency(detail.payment.amount)}
              hint={detail.payment.direction === "RECEIPT" ? "Money received" : "Money paid out"}
              accent={detail.payment.direction === "RECEIPT" ? "emerald" : "amber"}
            />

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-500">
                Related{" "}
                <span className="ml-2 font-medium text-slate-900">
                  {detail.payment.relatedType ? `${titleCase(detail.payment.relatedType)} ${detail.payment.relatedRef}` : "—"}
                </span>
              </p>
              <p className="text-slate-500">Customer <span className="ml-2 font-medium text-slate-900">{detail.payment.customer?.name ?? "—"}</span></p>
              <p className="text-slate-500">Property <span className="ml-2 font-medium text-slate-900">{detail.payment.property?.title ?? "—"}</span></p>
              <p className="text-slate-500">Payment date <span className="ml-2 font-medium text-slate-900">{formatDate(detail.payment.paymentDate)}</span></p>
              <p className="text-slate-500">Created by <span className="ml-2 font-medium text-slate-900">{detail.payment.createdBy?.name ?? "—"}</span></p>
              {detail.payment.notes ? <p className="text-slate-500 sm:col-span-2">Notes <span className="ml-2 font-medium text-slate-900">{detail.payment.notes}</span></p> : null}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <HistoryTimeline entries={detail.history} />
              </div>
            </div>

            {/* Status actions inside detail view */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {detail.payment.status === "PENDING" ? (
                <Button variant="success" onClick={() => setConfirmTarget(detail.payment)}>
                  <Check size={14} /> Confirm
                </Button>
              ) : null}
              {detail.payment.status !== "CANCELLED" ? (
                <Button variant="danger" onClick={() => setCancelTarget(detail.payment)}>
                  <Ban size={14} /> Cancel
                </Button>
              ) : null}
              {detail.payment.status === "CANCELLED" ? (
                <span className="text-xs text-slate-400">Cancelled — record a new payment if needed</span>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Confirm payment"
        message={`Confirm payment ${confirmTarget?.ref} of ${formatCurrency(confirmTarget?.amount ?? 0)}? It will count as ${confirmTarget?.direction === "RECEIPT" ? "received" : "paid"}.`}
        confirmLabel="Confirm payment"
        onConfirm={() => {
          if (confirmTarget) runAction(confirmTarget, "confirm");
          setConfirmTarget(null);
        }}
        onClose={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel payment"
        message={`Cancel payment ${cancelTarget?.ref} of ${formatCurrency(cancelTarget?.amount ?? 0)}? It will no longer count toward the totals.`}
        confirmLabel="Cancel payment"
        onConfirm={() => {
          if (cancelTarget) runAction(cancelTarget, "cancel");
          setCancelTarget(null);
        }}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
