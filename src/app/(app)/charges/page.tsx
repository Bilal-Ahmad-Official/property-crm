"use client";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";
import {
  CHARGE_STATUSES,
  CHARGE_TYPES,
  NOTICE_AUDIENCES,
  NOTICE_STATUSES,
  cn,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/utils";
import { Archive, Ban, Bell, Check, ClipboardList, Megaphone, Pencil, Plus, ReceiptText, Send, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Charge = {
  id: string;
  ref: string;
  title: string;
  chargeType: string;
  status: string;
  amount: number;
  chargeDate: string;
  dueDate?: string | null;
  notes?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedRef?: string | null;
  property?: { id: string; title: string; ref?: string | null } | null;
  customer?: { id: string; name: string; ref?: string | null } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
};

type Notice = {
  id: string;
  title: string;
  content: string;
  audience: string;
  status: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
};

type ChargeAction = "mark_paid" | "mark_waived" | "cancel";

const EMPTY_CHARGE_FORM = {
  title: "",
  chargeType: "SERVICE_CHARGE",
  amount: "",
  chargeDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  propertyId: "",
  customerId: "",
  notes: "",
};

const EMPTY_NOTICE_FORM = {
  title: "",
  content: "",
  audience: "ALL",
  status: "PUBLISHED",
  expiresAt: "",
};

const TABS: { key: "charges" | "notices"; label: string }[] = [
  { key: "charges", label: "Charges" },
  { key: "notices", label: "Notices" },
];

const ACTION_DIALOGS: Record<ChargeAction, { title: string; confirmLabel: string; message: (ref: string) => string }> = {
  mark_paid: {
    title: "Mark charge paid",
    confirmLabel: "Mark paid",
    message: (ref) => `Mark charge ${ref} as paid?`,
  },
  mark_waived: {
    title: "Waive charge",
    confirmLabel: "Waive charge",
    message: (ref) => `Waive charge ${ref}? The amount will no longer be owed.`,
  },
  cancel: {
    title: "Cancel charge",
    confirmLabel: "Cancel charge",
    message: (ref) => `Cancel charge ${ref}? This removes it from outstanding totals.`,
  },
};

export default function ChargesPage() {
  const [tab, setTab] = useState<"charges" | "notices">("charges");
  const [charges, setCharges] = useState<Charge[]>([]);
  const [summary, setSummary] = useState({ total: 0, outstanding: 0, paid: 0, waived: 0 });
  const [notices, setNotices] = useState<Notice[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string; ref?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "", chargeType: "" });
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [form, setForm] = useState({ ...EMPTY_CHARGE_FORM });
  const [saving, setSaving] = useState(false);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ ...EMPTY_NOTICE_FORM });
  const [actionTarget, setActionTarget] = useState<{ charge: Charge; action: ChargeAction } | null>(null);

  const canManageNotices = Boolean(me && ["ADMIN", "MANAGER"].includes(me.role));
  const canEditCharge = (c: Charge) => c.status === "PENDING";

  const loadCharges = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      if (filters.chargeType) params.set("chargeType", filters.chargeType);
      const res = await fetch(`/api/charges?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load charges");
      setCharges(data.charges);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load charges");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notices");
      setNotices(data.notices);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "charges") return;
    const t = setTimeout(loadCharges, 250);
    return () => clearTimeout(t);
  }, [tab, loadCharges]);

  useEffect(() => {
    if (tab !== "notices") return;
    loadNotices();
  }, [tab, loadNotices]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user)).catch(() => {});
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(d.contacts || [])).catch(() => {});
    fetch("/api/properties").then((r) => r.json()).then((d) => setProperties(d.properties || [])).catch(() => {});
  }, []);

  function openAddCharge() {
    setEditingCharge(null);
    setForm({ ...EMPTY_CHARGE_FORM });
    setChargeModalOpen(true);
  }

  function openEditCharge(c: Charge) {
    setEditingCharge(c);
    setForm({
      title: c.title,
      chargeType: c.chargeType,
      amount: String(c.amount),
      chargeDate: c.chargeDate ? new Date(c.chargeDate).toISOString().slice(0, 10) : "",
      dueDate: c.dueDate ? new Date(c.dueDate).toISOString().slice(0, 10) : "",
      propertyId: c.property?.id || "",
      customerId: c.customer?.id || "",
      notes: c.notes || "",
    });
    setChargeModalOpen(true);
  }

  function openAddNotice() {
    setNoticeForm({ ...EMPTY_NOTICE_FORM });
    setNoticeModalOpen(true);
  }

  async function saveCharge() {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount || 0),
        dueDate: form.dueDate || null,
        propertyId: form.propertyId || null,
        customerId: form.customerId || null,
      };
      const res = await fetch(editingCharge ? `/api/charges/${editingCharge.id}` : "/api/charges", {
        method: editingCharge ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save charge");
      setChargeModalOpen(false);
      setError(null);
      setToast(editingCharge ? "Charge updated" : "Charge created");
      loadCharges();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save charge");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotice() {
    if (!form.title.trim() || !noticeForm.content.trim()) {
      setError("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...noticeForm, expiresAt: noticeForm.expiresAt || null };
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notice");
      setNoticeModalOpen(false);
      setError(null);
      setToast("Notice created");
      loadNotices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notice");
    } finally {
      setSaving(false);
    }
  }

  async function runChargeAction(c: Charge, action: ChargeAction) {
    try {
      const res = await fetch(`/api/charges/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setToast(`Charge ${c.ref}: ${action.replace("_", " ")} done`);
      loadCharges();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function runNoticeAction(n: Notice, action: "publish" | "archive") {
    try {
      const res = await fetch("/api/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setError(null);
      setToast(`Notice ${action === "publish" ? "published" : "archived"}`);
      loadNotices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  const set = (k: keyof typeof EMPTY_CHARGE_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setN = (k: keyof typeof EMPTY_NOTICE_FORM) => (e: { target: { value: string } }) =>
    setNoticeForm((f) => ({ ...f, [k]: e.target.value }));

  const pendingCount = charges.filter((c) => c.status === "PENDING").length;
  const paidCount = charges.filter((c) => c.status === "PAID").length;
  const waivedCount = charges.filter((c) => c.status === "WAIVED").length;

  return (
    <div>
      <PageHeader
        title="Charges & Notices"
        subtitle="Record charges against customers and properties, and publish notices to the team"
        actions={
          tab === "charges" ? (
            <Button onClick={openAddCharge}>
              <Plus size={15} /> New charge
            </Button>
          ) : canManageNotices ? (
            <Button onClick={openAddNotice}>
              <Plus size={15} /> New notice
            </Button>
          ) : null
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
      {toast && !error ? <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</div> : null}

      {/* Tabs */}
      <Card className="mb-4 flex flex-wrap gap-1 p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition",
              tab === t.key ? "bg-brand-600 text-white" : "hover:bg-slate-100"
            )}
          >
            {t.label}
          </button>
        ))}
      </Card>

      {tab === "charges" ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Outstanding"
              value={formatCurrency(summary.outstanding, true)}
              hint={`${pendingCount} pending charge${pendingCount === 1 ? "" : "s"}`}
              icon={<ReceiptText size={18} />}
              accent="violet"
            />
            <StatCard
              label="Paid"
              value={formatCurrency(summary.paid, true)}
              hint={`${paidCount} settled`}
              icon={<Check size={18} />}
              accent="emerald"
            />
            <StatCard
              label="Waived"
              value={formatCurrency(summary.waived, true)}
              hint={`${waivedCount} waived`}
              icon={<Ban size={18} />}
              accent="amber"
            />
          </div>

          {/* Filters */}
          <Card className="mb-4 mt-6 flex flex-wrap items-center gap-2 p-3">
            <input
              className="input sm:max-w-xs"
              placeholder="Search ref, title, related ref…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
            <select className="input sm:w-44" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {CHARGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
            <select className="input sm:w-44" value={filters.chargeType} onChange={(e) => setFilters((f) => ({ ...f, chargeType: e.target.value }))}>
              <option value="">All types</option>
              {CHARGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Card>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="h-6 w-6" />
            </div>
          ) : charges.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={36} />}
              title="No charges found"
              hint="Record a charge to track amounts owed by a customer or property."
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Ref</th>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Property</th>
                      <th className="px-4 py-3 font-semibold">Due date</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">{c.ref}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{c.title}</span>
                          {c.relatedRef ? <span className="ml-2 font-mono text-xs text-slate-400">{c.relatedRef}</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          <Badge value={c.chargeType} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(c.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge value={c.status} />
                        </td>
                        <td className="px-4 py-3">
                          {c.property ? <span className="font-medium">{c.property.title}</span> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(c.dueDate)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            {canEditCharge(c) ? (
                              <button onClick={() => openEditCharge(c)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                                <Pencil size={14} />
                              </button>
                            ) : null}
                            {c.status === "PENDING" ? (
                              <>
                                <button onClick={() => setActionTarget({ charge: c, action: "mark_paid" })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Mark paid">
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setActionTarget({ charge: c, action: "mark_waived" })} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Waive">
                                  <Undo2 size={14} />
                                </button>
                                <button onClick={() => setActionTarget({ charge: c, action: "cancel" })} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel charge">
                                  <X size={14} />
                                </button>
                              </>
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
        </>
      ) : (
        /* Notices tab */
        loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="h-6 w-6" />
          </div>
        ) : notices.length === 0 ? (
          <EmptyState
            icon={<Bell size={36} />}
            title="No notices yet"
            hint={canManageNotices ? "Publish a notice to announce something to the whole team." : "Notices from managers and administrators will appear here."}
          />
        ) : (
          <div className="space-y-2">
            {notices.map((n) => (
              <Card key={n.id} className={cn("p-4", n.status === "ARCHIVED" && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Megaphone size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <Badge value={n.audience} />
                      <Badge value={n.status} />
                    </div>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500">{n.content}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{n.publishedAt ? `Published ${formatDate(n.publishedAt)}` : "Not published"}</span>
                      {n.expiresAt ? <span>· Expires {formatDate(n.expiresAt)}</span> : null}
                      {n.createdBy ? <span>· {n.createdBy.name}</span> : null}
                    </p>
                  </div>
                  {canManageNotices ? (
                    <div className="flex shrink-0 items-center gap-1">
                      {n.status !== "PUBLISHED" ? (
                        <button onClick={() => runNoticeAction(n, "publish")} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Publish">
                          <Send size={14} />
                        </button>
                      ) : null}
                      {n.status === "PUBLISHED" ? (
                        <button onClick={() => runNoticeAction(n, "archive")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Archive">
                          <Archive size={14} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Add / edit charge modal */}
      <Modal open={chargeModalOpen} onClose={() => setChargeModalOpen(false)} title={editingCharge ? `Edit charge ${editingCharge.ref}` : "New charge"} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Late payment fee — Marina View 4B" />
          </div>
          <div>
            <label className="label">Charge type</label>
            <select className="input" value={form.chargeType} onChange={set("chargeType")}>
              {CHARGE_TYPES.map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount *</label>
            <input className="input" type="number" min="0" value={form.amount} onChange={set("amount")} />
          </div>
          <div>
            <label className="label">Charge date</label>
            <input className="input" type="date" value={form.chargeDate} onChange={set("chargeDate")} />
          </div>
          <div>
            <label className="label">Due date</label>
            <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
          </div>
          <div>
            <label className="label">Property</label>
            <select className="input" value={form.propertyId} onChange={set("propertyId")}>
              <option value="">No property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={form.customerId} onChange={set("customerId")}>
              <option value="">No customer</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          New charges start as pending — only pending charges can be edited. Mark them paid or waived once resolved.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setChargeModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveCharge} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editingCharge ? "Save changes" : "Create charge"}
          </Button>
        </div>
      </Modal>

      {/* Add notice modal */}
      <Modal open={noticeModalOpen} onClose={() => setNoticeModalOpen(false)} title="New notice">
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={noticeForm.title} onChange={setN("title")} placeholder="e.g. Office closed on Friday" />
          </div>
          <div>
            <label className="label">Content *</label>
            <textarea className="input" rows={4} value={noticeForm.content} onChange={setN("content")} placeholder="What should the team know?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Audience</label>
              <select className="input" value={noticeForm.audience} onChange={setN("audience")}>
                {NOTICE_AUDIENCES.map((a) => (
                  <option key={a} value={a}>{titleCase(a)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={noticeForm.status} onChange={setN("status")}>
                {NOTICE_STATUSES.map((s) => (
                  <option key={s} value={s}>{titleCase(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Expires</label>
              <input className="input" type="date" value={noticeForm.expiresAt} onChange={setN("expiresAt")} />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setNoticeModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveNotice} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            Create notice
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(actionTarget)}
        title={actionTarget ? ACTION_DIALOGS[actionTarget.action].title : ""}
        message={actionTarget ? ACTION_DIALOGS[actionTarget.action].message(actionTarget.charge.ref) : ""}
        confirmLabel={actionTarget ? ACTION_DIALOGS[actionTarget.action].confirmLabel : "Confirm"}
        onConfirm={() => {
          if (actionTarget) runChargeAction(actionTarget.charge, actionTarget.action);
          setActionTarget(null);
        }}
        onClose={() => setActionTarget(null)}
      />
    </div>
  );
}
