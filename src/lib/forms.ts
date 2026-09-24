import { date } from "@/lib/api";

function toNum(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Coerce a raw JSON body into Prisma data for the Property model. */
export function propertyData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {};
  const s = (k: string) => (body[k] !== undefined && body[k] !== null ? String(body[k]) : undefined);
  const n = (k: string) => (body[k] !== undefined && body[k] !== null && body[k] !== "" ? Number(body[k]) : undefined);
  const req = (k: string) => {
    const v = s(k);
    if (v === undefined) {
      if (isCreate) throw new Error(`${k} is required`);
      return undefined;
    }
    return v;
  };
  const title = req("title");
  if (title !== undefined) data.title = title;
  const address = req("address");
  if (address !== undefined) data.address = address;
  const city = req("city");
  if (city !== undefined) data.city = city;
  if (s("description") !== undefined) data.description = s("description");
  if (s("type") !== undefined) data.type = s("type")!.toUpperCase();
  if (s("status") !== undefined) data.status = s("status")!.toUpperCase();
  if (s("listingType") !== undefined) data.listingType = s("listingType")!.toUpperCase();
  if (n("price") !== undefined) data.price = n("price");
  if (n("bedrooms") !== undefined) data.bedrooms = n("bedrooms");
  if (n("bathrooms") !== undefined) data.bathrooms = n("bathrooms");
  if (n("area") !== undefined) data.area = n("area");
  if (s("state") !== undefined) data.state = s("state");
  if (s("zip") !== undefined) data.zip = s("zip");
  if (s("imageUrl") !== undefined) data.imageUrl = s("imageUrl") || null;
  if (body.featured !== undefined) data.featured = Boolean(body.featured);
  if (body.ownerId !== undefined) data.ownerId = body.ownerId ? String(body.ownerId) : null;
  return data;
}

/** Coerce a raw JSON body into Prisma data for the Lead model. */
export function leadData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const s = (k: string) => (body[k] !== undefined && body[k] !== null ? String(body[k]) : undefined);
  if (s("name") !== undefined) data.name = s("name");
  if (s("email") !== undefined) data.email = s("email") || null;
  if (s("phone") !== undefined) data.phone = s("phone") || null;
  if (s("source") !== undefined) data.source = s("source")!.toUpperCase();
  if (s("status") !== undefined) data.status = s("status")!.toUpperCase();
  if (s("interest") !== undefined) data.interest = s("interest") || null;
  if (s("notes") !== undefined) data.notes = s("notes") || null;
  if (body.budgetMin !== undefined) data.budgetMin = body.budgetMin === "" ? null : toNum(body.budgetMin as string | number) ?? null;
  if (body.budgetMax !== undefined) data.budgetMax = body.budgetMax === "" ? null : toNum(body.budgetMax as string | number) ?? null;
  if (body.score !== undefined && body.score !== "") data.score = Number(body.score);
  if (body.propertyId !== undefined) data.propertyId = body.propertyId ? String(body.propertyId) : null;
  if (body.contactId !== undefined) data.contactId = body.contactId ? String(body.contactId) : null;
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId ? String(body.assignedToId) : null;
  return data;
}

/** Coerce a raw JSON body into Prisma data for the Contact model. */
export function contactData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const s = (k: string) => (body[k] !== undefined && body[k] !== null ? String(body[k]) : undefined);
  if (s("name") !== undefined) data.name = s("name");
  if (s("email") !== undefined) data.email = s("email") || null;
  if (s("phone") !== undefined) data.phone = s("phone") || null;
  if (s("type") !== undefined) data.type = s("type")!.toUpperCase();
  if (s("notes") !== undefined) data.notes = s("notes") || null;
  if (s("address") !== undefined) data.address = s("address") || null;
  return data;
}

/** Coerce a raw JSON body into Prisma data for the Deal model. */
export function dealData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const s = (k: string) => (body[k] !== undefined && body[k] !== null ? String(body[k]) : undefined);
  if (s("title") !== undefined) data.title = s("title");
  if (s("type") !== undefined) data.type = s("type")!.toUpperCase();
  if (s("stage") !== undefined) data.stage = s("stage")!.toUpperCase();
  if (s("notes") !== undefined) data.notes = s("notes") || null;
  if (body.value !== undefined) data.value = body.value === "" ? 0 : toNum(body.value as string | number) ?? 0;
  if (body.commission !== undefined) data.commission = body.commission === "" ? 0 : toNum(body.commission as string | number) ?? 0;
  if (body.expectedCloseDate !== undefined) {
    data.expectedCloseDate = body.expectedCloseDate === "" ? null : date(body.expectedCloseDate as string) ?? null;
  }
  if (body.closedAt !== undefined) data.closedAt = body.closedAt ? new Date(String(body.closedAt)) : null;
  if (body.propertyId !== undefined) data.propertyId = body.propertyId ? String(body.propertyId) : null;
  if (body.contactId !== undefined) data.contactId = body.contactId ? String(body.contactId) : null;
  if (body.leadId !== undefined) data.leadId = body.leadId ? String(body.leadId) : null;
  if (body.ownerId !== undefined) data.ownerId = body.ownerId ? String(body.ownerId) : null;
  return data;
}

/** Coerce a raw JSON body into Prisma data for the Task model. */
export function taskData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const s = (k: string) => (body[k] !== undefined && body[k] !== null ? String(body[k]) : undefined);
  if (s("title") !== undefined) data.title = s("title");
  if (s("description") !== undefined) data.description = s("description") || null;
  if (s("priority") !== undefined) data.priority = s("priority")!.toUpperCase();
  if (s("status") !== undefined) data.status = s("status")!.toUpperCase();
  if (s("type") !== undefined) data.type = s("type")!.toUpperCase();
  if (body.dueDate !== undefined) data.dueDate = body.dueDate === "" ? null : date(body.dueDate as string) ?? null;
  if (body.relatedType !== undefined) {
    data.relatedType = body.relatedType ? String(body.relatedType).toUpperCase() : null;
    data.relatedId = body.relatedId ? String(body.relatedId) : null;
  } else if (body.relatedId !== undefined) {
    data.relatedId = body.relatedId ? String(body.relatedId) : null;
  }
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId ? String(body.assignedToId) : null;
  return data;
}

/* ---------- Shared coercers for the PMS transaction models ---------- */

function optNum(body: Record<string, unknown>, key: string, fallback = 0) {
  if (body[key] === undefined || body[key] === null || body[key] === "") return fallback;
  const n = Number(body[key]);
  return Number.isFinite(n) ? n : fallback;
}

function optDate(body: Record<string, unknown>, key: string, fallback: Date | null = null) {
  if (body[key] === undefined || body[key] === null || body[key] === "") return fallback;
  const d = new Date(String(body[key]));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function optStr(body: Record<string, unknown>, key: string) {
  return body[key] !== undefined && body[key] !== null ? String(body[key]) : undefined;
}

function relId(body: Record<string, unknown>, key: string) {
  return body[key] !== undefined ? (body[key] ? String(body[key]) : null) : undefined;
}

/** Require a related entity id on create. */
function reqId(body: Record<string, unknown>, key: string, label: string, isCreate: boolean) {
  const v = relId(body, key);
  if (v === undefined || v === null) {
    if (isCreate) throw new Error(`${label} is required`);
    return undefined;
  }
  return v;
}

/** Fields shared by Booking / Sale / Purchase / PropertyTransfer / BuyBack lifecycle models. */
function txnLifecycleData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (optStr(body, "notes") !== undefined) data.notes = optStr(body, "notes") || null;
  if (body.submittedAt !== undefined) data.submittedAt = optDate(body, "submittedAt");
  if (body.reviewNote !== undefined) data.reviewNote = optStr(body, "reviewNote") || null;
  return data;
}

export function bookingData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = { ...txnLifecycleData(body) };
  const customer = reqId(body, "customerId", "Customer", isCreate);
  if (customer !== undefined) data.customerId = customer;
  const property = reqId(body, "propertyId", "Property", isCreate);
  if (property !== undefined) data.propertyId = property;
  if (body.bookingAmount !== undefined || isCreate) data.bookingAmount = optNum(body, "bookingAmount");
  if (body.depositAmount !== undefined || isCreate) data.depositAmount = optNum(body, "depositAmount");
  if (body.bookingDate !== undefined || isCreate) data.bookingDate = optDate(body, "bookingDate", new Date());
  if (body.expectedCloseDate !== undefined || isCreate) data.expectedCloseDate = optDate(body, "expectedCloseDate");
  return data;
}

export function saleData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = { ...txnLifecycleData(body) };
  const customer = reqId(body, "customerId", "Customer", isCreate);
  if (customer !== undefined) data.customerId = customer;
  const property = reqId(body, "propertyId", "Property", isCreate);
  if (property !== undefined) data.propertyId = property;
  if (relId(body, "bookingId") !== undefined) data.bookingId = relId(body, "bookingId");
  if (body.saleAmount !== undefined || isCreate) data.saleAmount = optNum(body, "saleAmount");
  if (body.discountAmount !== undefined || isCreate) data.discountAmount = optNum(body, "discountAmount");
  if (body.commission !== undefined || isCreate) data.commission = optNum(body, "commission");
  if (body.saleDate !== undefined || isCreate) data.saleDate = optDate(body, "saleDate", new Date());
  if (relId(body, "agentId") !== undefined) data.agentId = relId(body, "agentId");
  return data;
}

export function purchaseData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = { ...txnLifecycleData(body) };
  const property = reqId(body, "propertyId", "Property", isCreate);
  if (property !== undefined) data.propertyId = property;
  const vendor = reqId(body, "vendorId", "Vendor", isCreate);
  if (vendor !== undefined) data.vendorId = vendor;
  if (body.purchaseAmount !== undefined || isCreate) data.purchaseAmount = optNum(body, "purchaseAmount");
  if (body.purchaseDate !== undefined || isCreate) data.purchaseDate = optDate(body, "purchaseDate", new Date());
  return data;
}

export function paymentData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {};
  if (optStr(body, "notes") !== undefined) data.notes = optStr(body, "notes") || null;
  if (optStr(body, "direction") !== undefined) data.direction = optStr(body, "direction")!.toUpperCase();
  else if (isCreate) data.direction = "RECEIPT";
  if (optStr(body, "method") !== undefined) data.method = optStr(body, "method")!.toUpperCase();
  if (optStr(body, "status") !== undefined) data.status = optStr(body, "status")!.toUpperCase();
  else if (isCreate) data.status = "CONFIRMED";
  if (body.amount !== undefined || isCreate) data.amount = optNum(body, "amount");
  if (body.paymentDate !== undefined || isCreate) data.paymentDate = optDate(body, "paymentDate", new Date());
  if (body.relatedType !== undefined) {
    data.relatedType = body.relatedType ? String(body.relatedType).toUpperCase() : null;
    data.relatedId = body.relatedId ? String(body.relatedId) : null;
    data.relatedRef = body.relatedRef ? String(body.relatedRef) : null;
  }
  if (relId(body, "customerId") !== undefined) data.customerId = relId(body, "customerId");
  if (relId(body, "propertyId") !== undefined) data.propertyId = relId(body, "propertyId");
  return data;
}

export function transferData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = { ...txnLifecycleData(body) };
  const property = reqId(body, "propertyId", "Property", isCreate);
  if (property !== undefined) data.propertyId = property;
  const toCustomer = reqId(body, "toCustomerId", "New owner", isCreate);
  if (toCustomer !== undefined) data.toCustomerId = toCustomer;
  if (relId(body, "fromCustomerId") !== undefined) data.fromCustomerId = relId(body, "fromCustomerId");
  if (body.transferFee !== undefined || isCreate) data.transferFee = optNum(body, "transferFee");
  if (body.transferDate !== undefined || isCreate) data.transferDate = optDate(body, "transferDate", new Date());
  return data;
}

export function buybackData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = { ...txnLifecycleData(body) };
  const property = reqId(body, "propertyId", "Property", isCreate);
  if (property !== undefined) data.propertyId = property;
  const customer = reqId(body, "customerId", "Customer", isCreate);
  if (customer !== undefined) data.customerId = customer;
  if (relId(body, "saleId") !== undefined) data.saleId = relId(body, "saleId");
  if (body.buybackAmount !== undefined || isCreate) data.buybackAmount = optNum(body, "buybackAmount");
  if (body.buybackDate !== undefined || isCreate) data.buybackDate = optDate(body, "buybackDate", new Date());
  if (optStr(body, "reason") !== undefined) data.reason = optStr(body, "reason") || null;
  return data;
}

export function chargeData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {};
  const title = optStr(body, "title");
  if (title !== undefined) data.title = title;
  else if (isCreate) throw new Error("title is required");
  if (optStr(body, "chargeType") !== undefined) data.chargeType = optStr(body, "chargeType")!.toUpperCase();
  else if (isCreate) data.chargeType = "SERVICE_CHARGE";
  if (optStr(body, "status") !== undefined) data.status = optStr(body, "status")!.toUpperCase();
  if (body.amount !== undefined || isCreate) data.amount = optNum(body, "amount");
  if (body.chargeDate !== undefined || isCreate) data.chargeDate = optDate(body, "chargeDate", new Date());
  if (body.dueDate !== undefined || isCreate) data.dueDate = optDate(body, "dueDate");
  if (optStr(body, "notes") !== undefined) data.notes = optStr(body, "notes") || null;
  if (relId(body, "propertyId") !== undefined) data.propertyId = relId(body, "propertyId");
  if (relId(body, "customerId") !== undefined) data.customerId = relId(body, "customerId");
  if (body.relatedType !== undefined) {
    data.relatedType = body.relatedType ? String(body.relatedType).toUpperCase() : null;
    data.relatedId = body.relatedId ? String(body.relatedId) : null;
    data.relatedRef = body.relatedRef ? String(body.relatedRef) : null;
  }
  return data;
}

export function noticeData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {};
  const title = optStr(body, "title");
  if (title !== undefined) data.title = title;
  else if (isCreate) throw new Error("title is required");
  const content = optStr(body, "content");
  if (content !== undefined) data.content = content;
  else if (isCreate) throw new Error("content is required");
  if (optStr(body, "audience") !== undefined) data.audience = optStr(body, "audience")!.toUpperCase();
  else if (isCreate) data.audience = "ALL";
  if (optStr(body, "status") !== undefined) data.status = optStr(body, "status")!.toUpperCase();
  else if (isCreate) data.status = "PUBLISHED";
  if (body.publishedAt !== undefined) data.publishedAt = optDate(body, "publishedAt");
  if (body.expiresAt !== undefined || isCreate) data.expiresAt = optDate(body, "expiresAt");
  return data;
}

export function projectData(body: Record<string, unknown>, isCreate: boolean) {
  const data: Record<string, unknown> = {};
  const name = optStr(body, "name");
  if (name !== undefined) data.name = name;
  else if (isCreate) throw new Error("name is required");
  if (optStr(body, "code") !== undefined) data.code = optStr(body, "code") || null;
  if (optStr(body, "type") !== undefined) data.type = optStr(body, "type")!.toUpperCase();
  if (optStr(body, "status") !== undefined) data.status = optStr(body, "status")!.toUpperCase();
  if (optStr(body, "city") !== undefined) data.city = optStr(body, "city") || null;
  if (optStr(body, "notes") !== undefined) data.notes = optStr(body, "notes") || null;
  return data;
}
