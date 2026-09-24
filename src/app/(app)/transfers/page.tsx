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
import { ArrowLeftRight, Ban, Check, CheckCircle2, ChevronRight, Clock, Eye, Pencil, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Transfer = {
  id: string;
  ref: string;
  status: string;
  transferFee: number;
  transferDate: string;
  notes?: string | null;
  reviewNote?: string | null;
  fromCustomer?: { id: string; name: string; ref?: string | null } | null;
  toCustomer: { id: string; name: string; ref?: string | null };
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
  fromCustomerId: "",
  toCustomerId: "",
  transferFee: "",
  transferDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [summary, setSummary] = useState({ total: 0, pendingReview: 0, approved: 0, completed: 0, feesTotal: 0 });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ transfer: Transfer; history: HistoryEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decision, setDecision] = useState<{ transfer: Transfer; action: "approve" | "reject" | "return" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transfer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transfer | null>(null);

  const canSubmit = (t: Transfer) =>
    ["DRAFT", "RETURNED"].includes(t.status) &&
    Boolean(me && (["SALES", "MANAGER", "ADMIN"].includes(me.role) || t.createdBy?.id === me.id));
  const canApprove = (t: Transfer) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(t.status) && Boolean(me && ["MANAGER", "ADMIN"].includes(me.role));
  const canEdit = (t: Transfer) => ["DRAFT", "REJECTED", "RETURNED"].includes(t.status);
  const canCancel = (t: Transfer) =>
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED"].includes(t.status) &&
    Boolean(me && (t.createdBy?.id === me.id || me.role === "ADMIN"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      const res = await fetch(`/api/transfers?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load transfers");
      setTransfers(data.transfers);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transfers");
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
      .then((d) => setProperties((d.properties || []).filter((p: { status: string }) => p.status !== "INACTIVE")))
      .catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(t: Transfer) {
    setEditing(t);
    setForm({
      propertyId: t.property.id,
      fromCustomerId: t.fromCustomer?.id ?? "",
      toCustomerId: t.toCustomer.id,
      transferFee: String(t.transferFee),
      transferDate: t.transferDate ? new Date(t.transferDate).toISOString().slice(0, 10) : "",
      notes: t.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.toCustomerId || !form.propertyId) {
      setError("Property and new owner are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        transferFee: Number(form.transferFee || 0),
      };
      const res = await fetch(editing ? `/api/transfers/${editing.id}` : "/api/transfers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save transfer");
      setModalOpen(false);
      setError(null);
      setNotice(editing ? "Transfer updated" : "Transfer created");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save transfer");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(t: Transfer, action: string, reason = "") {
    try {
      const res = await fetch(`/api/transfers/${t.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setNotice(`Transfer ${t.ref}: ${action.replace("_", " ")} done`);
      load();
      if (detail?.transfer.id === t.id) openDetail(t.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/transfers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load transfer");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transfer");
    } finally {
      setDetailLoading(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/transfers/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete");
    } else {
      setNotice("Transfer deleted");
    }
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Hand properties over to new owners and walk each transfer through review and approval"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> New transfer
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {notice && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total transfers" value={summary.total} hint={`${summary.approved} approved · ${summary.completed} completed`} icon={<ArrowLeftRight size={18} />} accent="brand" />
        <StatCard label="Pending review" value={summary.pendingReview} hint="Submitted or under review" icon={<Clock size={18} />} accent="amber" />
        <StatCard label="Fees collected" value={formatCurrency(summary.feesTotal, true)} hint="Transfer fees on open transfers" icon={<Check size={18} />} accent="emerald" />
        <StatCard label="Completed" value={summary.completed} hint="Ownership handovers finalized" icon={<CheckCircle2 size={18} />} accent="violet" />
      </div>

      {/* Filters */}
      <Card className="mb-4 mt-6 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search ref, owner, property…"
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
      ) : transfers.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={36} />}
          title="No transfers found"
          hint="Create a transfer to hand a property over to a new owner, then submit it for approval."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Ref</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">From → To</th>
                  <th className="px-4 py-3 font-semibold">Fee</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{t.ref}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{t.property.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.fromCustomer?.name ?? "—"} <span className="text-slate-400">→</span> <span className="font-medium">{t.toCustomer.name}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(t.transferFee)}</td>
                    <td className="px-4 py-3">
                      <Badge value={t.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(t.transferDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openDetail(t.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View details">
                          <Eye size={14} />
                        </button>
                        {canEdit(t) ? (
                          <button onClick={() => openEdit(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {canSubmit(t) ? (
                          <button onClick={() => runAction(t, "submit")} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Submit for approval">
                            <Send size={14} />
                          </button>
                        ) : null}
                        {canApprove(t) ? (
                          <>
                            <button onClick={() => setDecision({ transfer: t, action: "approve" })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setDecision({ transfer: t, action: "return" })} className="rounded-md p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600" title="Return for correction">
                              <Undo2 size={14} />
                            </button>
                            <button onClick={() => setDecision({ transfer: t, action: "reject" })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Reject">
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {canCancel(t) ? (
                          <button onClick={() => setCancelTarget(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cancel transfer">
                            <Ban size={14} />
                          </button>
                        ) : null}
                        {me?.role === "ADMIN" && ["DRAFT", "REJECTED", "CANCELLED"].includes(t.status) ? (
                          <button onClick={() => setDeleteTarget(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit transfer ${editing.ref}` : "New transfer"} wide>
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
            <label className="label">From customer</label>
            <select className="input" value={form.fromCustomerId} onChange={set("fromCustomerId")}>
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">To customer *</label>
            <select className="input" value={form.toCustomerId} onChange={set("toCustomerId")}>
              <option value="">Select customer…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Transfer fee</label>
            <input className="input" type="number" min="0" value={form.transferFee} onChange={set("transferFee")} />
          </div>
          <div>
            <label className="label">Transfer date</label>
            <input className="input" type="date" value={form.transferDate} onChange={set("transferDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          New transfers start as drafts. Submit them for manager/admin approval — approving finalizes the ownership handover on the transfer record.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Create transfer"}
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail ? `Transfer ${detail.transfer.ref}` : "Transfer"} wide>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge value={detail.transfer.status} />
              {detail.transfer.reviewNote ? (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                  Review note: {detail.transfer.reviewNote}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-500">Property <span className="ml-2 font-medium text-slate-900">{detail.transfer.property.title}</span></p>
              <p className="text-slate-500">Transfer fee <span className="ml-2 font-medium text-slate-900">{formatCurrency(detail.transfer.transferFee)}</span></p>
              <p className="text-slate-500">From <span className="ml-2 font-medium text-slate-900">{detail.transfer.fromCustomer?.name ?? "—"}</span></p>
              <p className="text-slate-500">To <span className="ml-2 font-medium text-slate-900">{detail.transfer.toCustomer.name}</span></p>
              <p className="text-slate-500">Transfer date <span className="ml-2 font-medium text-slate-900">{formatDate(detail.transfer.transferDate)}</span></p>
              <p className="text-slate-500">Created by <span className="ml-2 font-medium text-slate-900">{detail.transfer.createdBy?.name ?? "—"}</span></p>
              {detail.transfer.notes ? <p className="text-slate-500 sm:col-span-2">Notes <span className="ml-2 font-medium text-slate-900">{detail.transfer.notes}</span></p> : null}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <div className="rounded-xl border border-slate-200 p-4">
                <HistoryTimeline entries={detail.history} />
              </div>
            </div>

            {/* Lifecycle actions inside detail view */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {canSubmit(detail.transfer) ? (
                <Button variant="secondary" onClick={() => runAction(detail.transfer, "submit")}>
                  <Send size={14} /> Submit for approval
                </Button>
              ) : null}
              {canApprove(detail.transfer) ? (
                <>
                  <Button variant="success" onClick={() => setDecision({ transfer: detail.transfer, action: "approve" })}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setDecision({ transfer: detail.transfer, action: "return" })}>
                    <Undo2 size={14} /> Return
                  </Button>
                  <Button variant="danger" onClick={() => setDecision({ transfer: detail.transfer, action: "reject" })}>
                    <X size={14} /> Reject
                  </Button>
                </>
              ) : null}
              {detail.transfer.status === "APPROVED" ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  Finalized — ownership recorded on this transfer <ChevronRight size={12} />
                </span>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <DecisionDialog
        open={Boolean(decision)}
        action={decision?.action ?? "approve"}
        entityLabel={decision ? `transfer ${decision.transfer.ref}` : "transfer"}
        onConfirm={(reason) => {
          if (decision) runAction(decision.transfer, decision.action, reason);
          setDecision(null);
        }}
        onClose={() => setDecision(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel transfer"
        message={`Cancel transfer ${cancelTarget?.ref}? The handover will be marked as cancelled.`}
        confirmLabel="Cancel transfer"
        onConfirm={() => {
          if (cancelTarget) runAction(cancelTarget, "cancel");
          setCancelTarget(null);
        }}
        onClose={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete transfer"
        message={`Permanently delete transfer ${deleteTarget?.ref}? This cannot be undone.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
