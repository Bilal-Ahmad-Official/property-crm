/**
 * Approval & control helpers (SRS §8).
 *
 * Lifecycle per SRS §4: DRAFT → SUBMITTED → (UNDER_REVIEW) → APPROVED | REJECTED | RETURNED
 * Each transaction type may carry different approval responsibilities.
 */
export const TXN_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type TxnStatus = (typeof TXN_STATUSES)[number];

/** Statuses where a record can still be edited (SRS §6: finalized records are locked). */
export const TXN_EDITABLE_STATUSES: readonly string[] = ["DRAFT", "REJECTED", "RETURNED"];

/** Statuses still open for business (not finalized-rejected/cancelled). */
export const TXN_OPEN_STATUSES: readonly string[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "RETURNED"];

/** Statuses a record can be submitted from. */
export const TXN_SUBMITTABLE_FROM: readonly string[] = ["DRAFT", "RETURNED"];

/** Statuses a reviewer can decide from. */
export const TXN_DECIDABLE_FROM: readonly string[] = ["SUBMITTED", "UNDER_REVIEW"];

/**
 * Which roles may submit vs approve per transaction type.
 * Different transaction types require different approval responsibilities (SRS §8):
 * buy-backs are admin-approved; everything else manager or admin.
 */
export const APPROVAL_MATRIX: Record<
  string,
  { label: string; submit: readonly string[]; approve: readonly string[] }
> = {
  BOOKING: { label: "Booking", submit: ["SALES", "MANAGER", "ADMIN"], approve: ["MANAGER", "ADMIN"] },
  SALE: { label: "Sale", submit: ["SALES", "MANAGER", "ADMIN"], approve: ["MANAGER", "ADMIN"] },
  PURCHASE: {
    label: "Purchase",
    submit: ["INVENTORY", "SALES", "MANAGER", "ADMIN"],
    approve: ["MANAGER", "ADMIN"],
  },
  TRANSFER: { label: "Property transfer", submit: ["SALES", "MANAGER", "ADMIN"], approve: ["MANAGER", "ADMIN"] },
  BUYBACK: { label: "Buy-back", submit: ["SALES", "MANAGER", "ADMIN"], approve: ["ADMIN"] },
  CHARGE: { label: "Charge", submit: ["FINANCE", "SALES", "MANAGER", "ADMIN"], approve: ["MANAGER", "ADMIN"] },
};

export function canSubmit(entityType: string, role: string): boolean {
  const rule = APPROVAL_MATRIX[entityType];
  return Boolean(rule && rule.submit.includes(role));
}

export function canApprove(entityType: string, role: string): boolean {
  const rule = APPROVAL_MATRIX[entityType];
  return Boolean(rule && rule.approve.includes(role));
}
