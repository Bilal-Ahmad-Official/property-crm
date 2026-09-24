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
import { Ban, Check, ChevronRight, ClipboardCheck, Clock, Eye, Pencil, Plus, Send, ShoppingBag, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Purchase = {
  id: string;
  ref: string;
  status: string;
  purchaseAmount: number;
  purchaseDate: string;
  notes?: string | null;
  reviewNote?: string | null;
  vendor: { id: string; name: string; ref?: string | null };
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
  vendorId: "",
  purchaseAmount: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState({ total: 0, pendingReview: 0, approved: 0, completed: 0, purchaseValue: 0 });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ purchase: Purchase; history: HistoryEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decision, setDecision] = useState<{ purchase: Purchase; action: "approve" | "reject" | "return" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);

  const canSubmit = (p: Purchase) =>
    ["DRAFT", "RETURNED"].includes(p.status) &&
    Boolean(me && (["INVENTORY", "SALES", "MANAGER", "ADMIN"].includes(me.role) || p.createdBy?.id === me.id));
  const canApprove = (p: Purchase) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(p.status) && Boolean(me && ["MANAGER", "ADMIN"].includes(me.role));
  const canEdit = (p: Purchase) => ["DRAFT", "REJECTED", "RETURNED"].includes(p.status);
  const canCancel = (p: Purchase) =>
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(p.status) &&
    Boolean(me && (p.createdBy?.id === me.id || me.role === "ADMIN"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      const res = await fetch(`/api/purchases?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load purchases");
      setPurchases(data.purchases);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load purchases");
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
    fetch("/api/contacts?type=VENDOR").then((r) => r.json()).then((d) => setVendors(d.contacts || [])).catch(() => {});
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

  function openEdit(p: Purchase) {
    setEditing(p);
    setForm({
      propertyId: p.property.id,
      vendorId: p.vendor.id,
      purchaseAmount: String(p.purchaseAmount),
      purchaseDate: p.purchaseDate ? new Date(p.purchaseDate).toISOString().slice(0, 10) : "",
      notes: p.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.propertyId || !form.vendorId) {
      setError("Property and vendor are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchaseAmount: Number(form.purchaseAmount || 0),
      };
      const res = await fetch(editing ? `/api/purchases/${editing.id}` : "/api/purchases", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save purchase");
      setModalOpen(false);
      setError(null);
      setNotice(editing ? "Purchase updated" : "Purchase created");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(p: Purchase, action: string, reason = "") {
    try {
      const res = await fetch(`/api/purchases/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setNotice(`Purchase ${p.ref}: ${action.replace("_", " ")} done`);
      load();
      if (detail?.purchase.id === p.id) openDetail(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/purchases/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load purchase");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load purchase");
    } finally {
      setDetailLoading(false);
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Acquire properties from vendors and walk each purchase through review and approval"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> New purchase
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {notice && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total purchases" value={summary.total} hint={`${summary.approved} approved · ${summary.completed} completed`} icon={<ShoppingBag size={18} />} accent="brand" />
        <StatCard label="Pending review" value={summary.pendingReview} hint="Submitted or under review" icon={<Clock size={18} />} accent="amber" />
        <StatCard label="Purchase value" value={formatCurrency(summary.purchaseValue, true)} hint="Sum of open purchase amounts" icon={<Check size={18} />} accent="emerald" />
        <StatCard label="Completed" value={summary.completed} hint="Finalized acquisitions" icon={<ClipboardCheck size={18} />} accent="violet" />
      </div>

      {/* Filters */}
      <Card className="mb-4 mt-6 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search ref, vendor, property…"
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
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={36} />}
          title="No purchases found"
          hint="Create a purchase to acquire a property from a vendor, then submit it for approval."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Ref</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{p.ref}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.property.title}</span>
                    </td>
                    <td className="px-4 py-3">{p.vendor.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(p.purchaseAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge value={p.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(p.purchaseDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openDetail(p.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View details">
                          <Eye size={14} />
                        </button>
                        {canEdit(p) ? (
                          <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {canSubmit(p) ? (
                          <button onClick={() => runAction(p, "submit")} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Submit for approval">
                            <Send size={14} />
                          </button>
                        ) : null}
                        {canApprove(p) ? (
                          <>
                            <button onClick={() => setDecision({ purchase: p, action: "approve" })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setDecision({ purchase: p, action: "return" })} className="rounded-md p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600" title="Return for correction">
                              <Undo2 size={14} />
                            </button>
                            <button onClick={() => setDecision({ purchase: p, action: "reject" })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Reject">
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {canCancel(p) ? (
                          <button onClick={() => setCancelTarget(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cancel purchase">
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit purchase ${editing.ref}` : "New purchase"} wide>
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
            <label className="label">Vendor *</label>
            <select className="input" value={form.vendorId} onChange={set("vendorId")}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Purchase amount *</label>
            <input className="input" type="number" min="0" value={form.purchaseAmount} onChange={set("purchaseAmount")} />
          </div>
          <div>
            <label className="label">Purchase date</label>
            <input className="input" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          New purchases start as drafts. Submit them for manager/admin approval — approving finalizes the acquisition.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Create purchase"}
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail ? `Purchase ${detail.purchase.ref}` : "Purchase"} wide>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={detail.purchase.status} />
              {detail.purchase.reviewNote ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  Review note: {detail.purchase.reviewNote}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Purchase amount" value={formatCurrency(detail.purchase.purchaseAmount)} accent="brand" />
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-500">Property <span className="ml-2 font-medium text-slate-900">{detail.purchase.property.title}</span></p>
              <p className="text-slate-500">Vendor <span className="ml-2 font-medium text-slate-900">{detail.purchase.vendor.name}</span></p>
              <p className="text-slate-500">Purchase date <span className="ml-2 font-medium text-slate-900">{formatDate(detail.purchase.purchaseDate)}</span></p>
              <p className="text-slate-500">Created by <span className="ml-2 font-medium text-slate-900">{detail.purchase.createdBy?.name ?? "—"}</span></p>
              {detail.purchase.notes ? <p className="text-slate-500 sm:col-span-2">Notes <span className="ml-2 font-medium text-slate-900">{detail.purchase.notes}</span></p> : null}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <HistoryTimeline entries={detail.history} />
              </div>
            </div>

            {/* Lifecycle actions inside detail view */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {canSubmit(detail.purchase) ? (
                <Button variant="secondary" onClick={() => runAction(detail.purchase, "submit")}>
                  <Send size={14} /> Submit for approval
                </Button>
              ) : null}
              {canApprove(detail.purchase) ? (
                <>
                  <Button variant="success" onClick={() => setDecision({ purchase: detail.purchase, action: "approve" })}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setDecision({ purchase: detail.purchase, action: "return" })}>
                    <Undo2 size={14} /> Return
                  </Button>
                  <Button variant="danger" onClick={() => setDecision({ purchase: detail.purchase, action: "reject" })}>
                    <X size={14} /> Reject
                  </Button>
                </>
              ) : null}
              {detail.purchase.status === "APPROVED" ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  Finalized — record payments from the Payments module <ChevronRight size={12} />
                </span>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <DecisionDialog
        open={Boolean(decision)}
        action={decision?.action ?? "approve"}
        entityLabel={decision ? `purchase ${decision.purchase.ref}` : "purchase"}
        onConfirm={(reason) => {
          if (decision) runAction(decision.purchase, decision.action, reason);
          setDecision(null);
        }}
        onClose={() => setDecision(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel purchase"
        message={`Cancel purchase ${cancelTarget?.ref}? The record is withdrawn from approval.`}
        confirmLabel="Cancel purchase"
        onConfirm={() => {
          if (cancelTarget) runAction(cancelTarget, "cancel");
          setCancelTarget(null);
        }}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
