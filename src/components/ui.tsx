"use client";

import { cn, formatDateTime, titleCase } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

/* ---------- Button ---------- */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Badge ---------- */
const badgeColors: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  SOLD: "bg-blue-50 text-blue-700 ring-blue-600/20",
  RENTED: "bg-violet-50 text-violet-700 ring-violet-600/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-500/20",
  NEW: "bg-blue-50 text-blue-700 ring-blue-600/20",
  CONTACTED: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  QUALIFIED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  VIEWING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  NEGOTIATION: "bg-orange-50 text-orange-700 ring-orange-600/20",
  WON: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  LOST: "bg-red-50 text-red-700 ring-red-600/20",
  CLOSED_WON: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CLOSED_LOST: "bg-red-50 text-red-700 ring-red-600/20",
  OFFER_MADE: "bg-blue-50 text-blue-700 ring-blue-600/20",
  DUE_DILIGENCE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CONTRACT: "bg-violet-50 text-violet-700 ring-violet-600/20",
  CLOSING: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  PENDING: "bg-slate-100 text-slate-700 ring-slate-500/20",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-red-50 text-red-600 ring-red-600/20",
  LOW: "bg-slate-100 text-slate-600 ring-slate-500/20",
  MEDIUM: "bg-blue-50 text-blue-700 ring-blue-600/20",
  HIGH: "bg-amber-50 text-amber-700 ring-amber-600/20",
  URGENT: "bg-red-50 text-red-700 ring-red-600/20",
  SALE: "bg-brand-50 text-brand-700 ring-brand-600/20",
  RENT: "bg-teal-50 text-teal-700 ring-teal-600/20",
  BUYER: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SELLER: "bg-amber-50 text-amber-700 ring-amber-600/20",
  TENANT: "bg-violet-50 text-violet-700 ring-violet-600/20",
  LANDLORD: "bg-teal-50 text-teal-700 ring-teal-600/20",
  VENDOR: "bg-orange-50 text-orange-700 ring-orange-600/20",
  OTHER: "bg-slate-100 text-slate-600 ring-slate-500/20",
  // PMS transaction lifecycle (SRS §4)
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  RETURNED: "bg-orange-50 text-orange-700 ring-orange-600/20",
  // Payments & receipts (SRS §7)
  RECEIPT: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PAYMENT: "bg-orange-50 text-orange-700 ring-orange-600/20",
  CASH: "bg-slate-100 text-slate-600 ring-slate-500/20",
  BANK_TRANSFER: "bg-blue-50 text-blue-700 ring-blue-600/20",
  CHEQUE: "bg-violet-50 text-violet-700 ring-violet-600/20",
  CARD: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20",
  // Charges & notices
  SERVICE_CHARGE: "bg-blue-50 text-blue-700 ring-blue-600/20",
  MAINTENANCE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  LATE_FEE: "bg-red-50 text-red-700 ring-red-600/20",
  UTILITY: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  LEGAL: "bg-violet-50 text-violet-700 ring-violet-600/20",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  WAIVED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  // Projects / grouping
  PROJECT: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  BLOCK: "bg-teal-50 text-teal-700 ring-teal-600/20",
  PHASE: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  CATEGORY: "bg-slate-100 text-slate-600 ring-slate-500/20",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  // Roles
  ADMIN: "bg-violet-50 text-violet-700 ring-violet-600/20",
  MANAGER: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SALES: "bg-brand-50 text-brand-700 ring-brand-600/20",
  FINANCE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  INVENTORY: "bg-amber-50 text-amber-700 ring-amber-600/20",
  AGENT: "bg-slate-100 text-slate-600 ring-slate-500/20",
  ALL: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Badge({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        badgeColors[value] || "bg-slate-100 text-slate-600 ring-slate-500/20",
        className
      )}
    >
      {children ?? titleCase(value)}
    </span>
  );
}

/* ---------- Card / StatCard ---------- */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "brand" | "emerald" | "amber" | "violet";
}) {
  const accents = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {icon ? <div className={cn("rounded-xl p-2.5", accents[accent])}>{icon}</div> : null}
      </div>
    </Card>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      {icon ? <div className="text-slate-300">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

/* ---------- Spinner ---------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600",
        className
      )}
    />
  );
}

/* ---------- Status/audit history timeline (SRS §8: audit/activity history) ---------- */
export type HistoryEntry = {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  user?: string | null;
  createdAt: string;
};

function actionLabel(h: HistoryEntry): string {
  if (h.toStatus && ["SUBMITTED", "APPROVED", "REJECTED", "RETURNED", "CANCELLED", "COMPLETED"].includes(h.action)) {
    return `${titleCase(h.action)} — now ${titleCase(h.toStatus)}`;
  }
  if (h.fromStatus && h.toStatus) return `${titleCase(h.fromStatus)} → ${titleCase(h.toStatus)}`;
  return titleCase(h.action);
}

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No history recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {entries.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-400 shadow-sm" />
          <p className="text-sm font-medium">{actionLabel(h)}</p>
          {h.note ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{h.note}</p> : null}
          <p className="mt-0.5 text-[11px] text-slate-400">
            {h.user ?? "System"} · {formatDateTime(h.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Decision dialog: approve / reject / return with a reason (SRS §8) ---------- */
export function DecisionDialog({
  open,
  action,
  entityLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  action: "approve" | "reject" | "return";
  entityLabel: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const config = {
    approve: { title: "Approve", message: `Approve this ${entityLabel}? This finalizes the record.`, button: "Approve", variant: "success" as const, required: false },
    reject: { title: "Reject", message: `Reject this ${entityLabel}? A reason is required.`, button: "Reject", variant: "danger" as const, required: true },
    return: { title: "Return for correction", message: `Return this ${entityLabel} to the submitter for correction? A reason is required.`, button: "Return", variant: "secondary" as const, required: true },
  }[action];

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = () => {
    if (config.required && !reason.trim()) return;
    onConfirm(reason.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title={`${config.title} — ${entityLabel}`}>
      <p className="text-sm text-slate-600">{config.message}</p>
      <div className="mt-4">
        <label className="label">Reason {config.required ? "*" : "(optional)"}</label>
        <textarea
          className="input"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={action === "approve" ? "e.g. Documents verified" : "e.g. Missing valuation report"}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={config.variant} onClick={submit} disabled={config.required && !reason.trim()}>
          {config.button}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- Confirm dialog (avoids native window.confirm) ---------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
