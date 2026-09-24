import { TXN_STATUSES } from "./approval";

export const CURRENCY = "USD";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatCurrency(value: number, compact = false, currency = CURRENCY): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact && value >= 10000 ? 1 : 0,
    notation: compact && value >= 100000 ? "compact" : "standard",
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "VILLA", "PLOT", "COMMERCIAL", "OFFICE"] as const;
export const PROPERTY_STATUSES = ["AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"] as const;
export const LISTING_TYPES = ["SALE", "RENT"] as const;
export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export const LEAD_SOURCES = ["WEBSITE", "REFERRAL", "WALK_IN", "CALL", "SOCIAL", "PORTAL", "OTHER"] as const;
export const DEAL_STAGES = [
  "OFFER_MADE",
  "DUE_DILIGENCE",
  "CONTRACT",
  "CLOSING",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;
export const CONTACT_TYPES = ["BUYER", "SELLER", "TENANT", "LANDLORD", "VENDOR", "OTHER"] as const;
export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TASK_TYPES = ["FOLLOW_UP", "VIEWING", "CALL", "MEETING", "PAPERWORK", "OTHER"] as const;
export { TXN_STATUSES };
export const PAYMENT_DIRECTIONS = ["RECEIPT", "PAYMENT"] as const;
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"] as const;
export const PAYMENT_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
export const CHARGE_TYPES = ["SERVICE_CHARGE", "MAINTENANCE", "LATE_FEE", "UTILITY", "LEGAL", "OTHER"] as const;
export const CHARGE_STATUSES = ["PENDING", "PAID", "WAIVED", "CANCELLED"] as const;
export const PROJECT_TYPES = ["PROJECT", "BLOCK", "PHASE", "CATEGORY"] as const;
export const PROJECT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const NOTICE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const NOTICE_AUDIENCES = ["ALL", "ADMIN", "MANAGER", "SALES", "FINANCE", "INVENTORY"] as const;
export const ROLES = ["ADMIN", "MANAGER", "SALES", "FINANCE", "INVENTORY"] as const;
