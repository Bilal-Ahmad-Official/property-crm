import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

export type ToolResult = Record<string, unknown> | unknown[] | string;

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
};
const nbr = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const toolSchemas: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "search_properties",
      description:
        "Search property listings in the CRM with optional filters. Returns a list of matching properties with id, title, type, status, listing type, price, bedrooms, bathrooms, area, city and address.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search over title, city and address" },
          type: { type: "string", description: "Property type: APARTMENT, HOUSE, VILLA, PLOT, COMMERCIAL or OFFICE" },
          status: { type: "string", description: "Status: AVAILABLE, RESERVED, SOLD, RENTED or INACTIVE" },
          listingType: { type: "string", description: "SALE or RENT" },
          minPrice: { type: "number", description: "Minimum price (or monthly rent)" },
          maxPrice: { type: "number", description: "Maximum price (or monthly rent)" },
          minBedrooms: { type: "number", description: "Minimum number of bedrooms" },
          city: { type: "string", description: "City name" },
          limit: { type: "number", description: "Max results to return (default 8)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_property",
      description: "Get full details of one property by its id, including description and counts of linked leads and deals.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Property id" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "portfolio_summary",
      description:
        "Summarize the whole property portfolio: counts by status and type, total portfolio value, average price and featured listings.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_leads",
      description:
        "Summarize leads: counts by pipeline status plus the most recent leads with name, status, budget, interest and assignee. Optionally filter by status.",
      parameters: {
        type: "object",
        properties: { status: { type: "string", description: "Filter: NEW, CONTACTED, QUALIFIED, VIEWING, NEGOTIATION, WON or LOST" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_leads",
      description: "List leads with optional status filter. Returns name, status, budget, interest, linked property and assignee.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Move a lead to a new pipeline status. Provide the lead id and the new status.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "Lead id" },
          status: { type: "string", description: "New status: NEW, CONTACTED, QUALIFIED, VIEWING, NEGOTIATION, WON or LOST" },
        },
        required: ["leadId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_deals",
      description:
        "Summarize deals: counts and value by stage, total open pipeline value and commission, won revenue. Optionally filter by stage.",
      parameters: {
        type: "object",
        properties: { stage: { type: "string", description: "Filter: OFFER_MADE, DUE_DILIGENCE, CONTRACT, CLOSING, CLOSED_WON or CLOSED_LOST" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deals",
      description: "List deals with optional stage filter. Returns title, value, commission, stage, property, contact and owner.",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", description: "Filter by stage" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_tasks",
      description:
        "Summarize tasks: counts by status, overdue tasks, and the next upcoming tasks with due dates, priorities and assignees.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter: PENDING, IN_PROGRESS, COMPLETED or CANCELLED" },
          overdueOnly: { type: "boolean", description: "Only show overdue open tasks" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task (follow-up, viewing, call, meeting, paperwork). Use when the user asks to add a task, set a reminder or schedule a follow-up.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Optional details" },
          dueDate: { type: "string", description: "Due date as YYYY-MM-DD" },
          priority: { type: "string", description: "LOW, MEDIUM, HIGH or URGENT" },
          type: { type: "string", description: "FOLLOW_UP, VIEWING, CALL, MEETING, PAPERWORK or OTHER" },
          relatedType: { type: "string", description: "Link to: PROPERTY, LEAD, DEAL or CONTACT" },
          relatedId: { type: "string", description: "Id of the related record" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark an existing task as completed by its id.",
      parameters: {
        type: "object",
        properties: { taskId: { type: "string", description: "Task id" } },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_contacts",
      description: "Search contacts/clients by name, email or phone, optionally filtered by type (BUYER, SELLER, TENANT, LANDLORD, VENDOR, OTHER).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, email or phone fragment" },
          type: { type: "string", description: "Contact type filter" },
          limit: { type: "number", description: "Max results (default 8)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description: "Add a note (activity) to a property, lead, deal or contact.",
      parameters: {
        type: "object",
        properties: {
          entityType: { type: "string", description: "PROPERTY, LEAD, DEAL or CONTACT" },
          entityId: { type: "string", description: "Id of the record" },
          content: { type: "string", description: "Note text" },
        },
        required: ["entityType", "entityId", "content"],
      },
    },
  },
];

const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "VILLA", "PLOT", "COMMERCIAL", "OFFICE"];
const PROPERTY_STATUSES = ["AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"];
const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION", "WON", "LOST"];
const DEAL_STAGES = ["OFFER_MADE", "DUE_DILIGENCE", "CONTRACT", "CLOSING", "CLOSED_WON", "CLOSED_LOST"];
const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const ENTITY_TYPES = ["PROPERTY", "LEAD", "DEAL", "CONTACT"];

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "search_properties": {
      const where: Record<string, unknown> = {};
      const and: Record<string, unknown>[] = [];
      const q = str(args.query);
      if (q) {
        and.push({
          OR: [
            { title: { contains: q } },
            { city: { contains: q } },
            { address: { contains: q } },
          ],
        });
      }
      const city = str(args.city);
      if (city) and.push({ city: { contains: city } });
      const type = str(args.type)?.toUpperCase();
      if (type && PROPERTY_TYPES.includes(type)) and.push({ type });
      const status = str(args.status)?.toUpperCase();
      if (status && PROPERTY_STATUSES.includes(status)) and.push({ status });
      const listingType = str(args.listingType)?.toUpperCase();
      if (listingType === "SALE" || listingType === "RENT") and.push({ listingType });
      const minPrice = nbr(args.minPrice);
      if (minPrice !== undefined) and.push({ price: { gte: minPrice } });
      const maxPrice = nbr(args.maxPrice);
      if (maxPrice !== undefined) and.push({ price: { lte: maxPrice } });
      const minBeds = nbr(args.minBedrooms);
      if (minBeds !== undefined) and.push({ bedrooms: { gte: minBeds } });
      if (and.length) where.AND = and;
      const limit = Math.min(nbr(args.limit) ?? 8, 25);
      const rows = await db.property.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { name: true } } },
      });
      return rows.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        listingType: p.listingType,
        price: p.price,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        areaSqFt: p.area,
        city: p.city,
        address: p.address,
        featured: p.featured,
        agent: p.owner?.name ?? null,
      }));
    }
    case "get_property": {
      const id = str(args.id);
      if (!id) return { error: "id is required" };
      const p = await db.property.findUnique({
        where: { id },
        include: { owner: { select: { name: true } }, _count: { select: { leads: true, deals: true } } },
      });
      if (!p) return { error: "Property not found" };
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        status: p.status,
        listingType: p.listingType,
        price: p.price,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        areaSqFt: p.area,
        address: p.address,
        city: p.city,
        agent: p.owner?.name ?? null,
        openLeads: p._count.leads,
        deals: p._count.deals,
      };
    }
    case "portfolio_summary": {
      const byStatus = await db.property.groupBy({ by: ["status"], _count: { _all: true }, _sum: { price: true } });
      const byType = await db.property.groupBy({ by: ["type"], _count: { _all: true } });
      const agg = await db.property.aggregate({ _count: { _all: true }, _sum: { price: true }, _avg: { price: true } });
      const featured = await db.property.count({ where: { featured: true } });
      return {
        totalProperties: agg._count._all,
        totalPortfolioValue: agg._sum.price ?? 0,
        averagePrice: Math.round(agg._avg.price ?? 0),
        featuredListings: featured,
        byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all, value: r._sum.price ?? 0 })),
        byType: byType.map((r) => ({ type: r.type, count: r._count._all })),
      };
    }
    case "summarize_leads": {
      const status = str(args.status)?.toUpperCase();
      const byStatus = await db.lead.groupBy({ by: ["status"], _count: { _all: true } });
      const where = status && LEAD_STATUSES.includes(status) ? { status } : {};
      const recent = await db.lead.findMany({
        where,
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { assignedTo: { select: { name: true } }, property: { select: { title: true } } },
      });
      return {
        totalLeads: byStatus.reduce((s, r) => s + r._count._all, 0),
        byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
        recent: recent.map((l) => ({
          id: l.id,
          name: l.name,
          status: l.status,
          budgetMin: l.budgetMin,
          budgetMax: l.budgetMax,
          interest: l.interest,
          property: l.property?.title ?? null,
          assignee: l.assignedTo?.name ?? null,
          createdAt: l.createdAt,
        })),
      };
    }
    case "list_leads": {
      const status = str(args.status)?.toUpperCase();
      const where = status && LEAD_STATUSES.includes(status) ? { status } : {};
      const limit = Math.min(nbr(args.limit) ?? 10, 25);
      const rows = await db.lead.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { assignedTo: { select: { name: true } }, property: { select: { title: true } } },
      });
      return rows.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        status: l.status,
        source: l.source,
        budgetMin: l.budgetMin,
        budgetMax: l.budgetMax,
        interest: l.interest,
        property: l.property?.title ?? null,
        assignee: l.assignedTo?.name ?? null,
        score: l.score,
      }));
    }
    case "update_lead_status": {
      const leadId = str(args.leadId);
      const status = str(args.status)?.toUpperCase();
      if (!leadId || !status) return { error: "leadId and status are required" };
      if (!LEAD_STATUSES.includes(status)) return { error: `Invalid status. Use: ${LEAD_STATUSES.join(", ")}` };
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) return { error: "Lead not found" };
      const updated = await db.lead.update({ where: { id: leadId }, data: { status } });
      await db.activity.create({
        data: {
          type: "STATUS_CHANGE",
          content: `Lead moved from ${lead.status} to ${status} by the AI assistant.`,
          entityType: "LEAD",
          entityId: leadId,
          leadId,
        },
      });
      return { id: updated.id, name: updated.name, status: updated.status };
    }
    case "summarize_deals": {
      const stage = str(args.stage)?.toUpperCase();
      const byStage = await db.deal.groupBy({ by: ["stage"], _count: { _all: true }, _sum: { value: true, commission: true } });
      const openStages = DEAL_STAGES.filter((s) => !s.startsWith("CLOSED"));
      const openAgg = await db.deal.aggregate({
        where: { stage: { in: openStages } },
        _sum: { value: true, commission: true },
        _count: { _all: true },
      });
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const wonAgg = await db.deal.aggregate({
        where: { stage: "CLOSED_WON", closedAt: { gte: yearStart } },
        _sum: { value: true, commission: true },
        _count: { _all: true },
      });
      const where = stage && DEAL_STAGES.includes(stage) ? { stage } : {};
      const recent = await db.deal.findMany({
        where,
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          property: { select: { title: true } },
          contact: { select: { name: true } },
          owner: { select: { name: true } },
        },
      });
      return {
        openPipelineValue: openAgg._sum.value ?? 0,
        openPipelineCommission: openAgg._sum.commission ?? 0,
        openDeals: openAgg._count._all,
        wonRevenueThisYear: wonAgg._sum.commission ?? 0,
        wonDealsThisYear: wonAgg._count._all,
        byStage: byStage.map((r) => ({ stage: r.stage, count: r._count._all, value: r._sum.value ?? 0 })),
        recent: recent.map((d) => ({
          id: d.id,
          title: d.title,
          stage: d.stage,
          value: d.value,
          commission: d.commission,
          property: d.property?.title ?? null,
          contact: d.contact?.name ?? null,
          owner: d.owner?.name ?? null,
          expectedCloseDate: d.expectedCloseDate,
        })),
      };
    }
    case "list_deals": {
      const stage = str(args.stage)?.toUpperCase();
      const where = stage && DEAL_STAGES.includes(stage) ? { stage } : {};
      const limit = Math.min(nbr(args.limit) ?? 10, 25);
      const rows = await db.deal.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          property: { select: { title: true } },
          contact: { select: { name: true } },
          owner: { select: { name: true } },
        },
      });
      return rows.map((d) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        value: d.value,
        commission: d.commission,
        type: d.type,
        property: d.property?.title ?? null,
        contact: d.contact?.name ?? null,
        owner: d.owner?.name ?? null,
        expectedCloseDate: d.expectedCloseDate,
      }));
    }
    case "summarize_tasks": {
      const status = str(args.status)?.toUpperCase();
      const overdueOnly = args.overdueOnly === true;
      const byStatus = await db.task.groupBy({ by: ["status"], _count: { _all: true } });
      const overdueWhere = { dueDate: { lt: new Date() }, status: { in: ["PENDING", "IN_PROGRESS"] } };
      const overdueCount = await db.task.count({ where: overdueWhere });
      let where: Record<string, unknown> = {};
      if (overdueOnly) where = overdueWhere;
      else if (status && TASK_STATUSES.includes(status)) where = { status };
      const upcoming = await db.task.findMany({
        where: Object.keys(where).length ? where : { status: { in: ["PENDING", "IN_PROGRESS"] } },
        take: 6,
        orderBy: { dueDate: "asc" },
        include: { assignedTo: { select: { name: true } } },
      });
      return {
        totalOpenTasks: byStatus.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").reduce((s, r) => s + r._count._all, 0),
        overdueTasks: overdueCount,
        byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
        upcoming: upcoming.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          type: t.type,
          dueDate: t.dueDate,
          assignee: t.assignedTo?.name ?? null,
        })),
      };
    }
    case "create_task": {
      const title = str(args.title);
      if (!title) return { error: "title is required" };
      const dueDate = str(args.dueDate);
      const priority = str(args.priority)?.toUpperCase();
      const type = str(args.type)?.toUpperCase();
      const relatedType = str(args.relatedType)?.toUpperCase();
      const relatedId = str(args.relatedId);
      const created = await db.task.create({
        data: {
          title,
          description: str(args.description),
          dueDate: dueDate ? new Date(dueDate) : null,
          priority: priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM",
          type: type && ["FOLLOW_UP", "VIEWING", "CALL", "MEETING", "PAPERWORK", "OTHER"].includes(type) ? type : "FOLLOW_UP",
          relatedType: relatedType && ENTITY_TYPES.includes(relatedType) ? relatedType : null,
          relatedId: relatedType && ENTITY_TYPES.includes(relatedType) ? relatedId : null,
        },
      });
      return { id: created.id, title: created.title, dueDate: created.dueDate, priority: created.priority, type: created.type };
    }
    case "complete_task": {
      const taskId = str(args.taskId);
      if (!taskId) return { error: "taskId is required" };
      const t = await db.task.findUnique({ where: { id: taskId } });
      if (!t) return { error: "Task not found" };
      const updated = await db.task.update({ where: { id: taskId }, data: { status: "COMPLETED" } });
      return { id: updated.id, title: updated.title, status: updated.status };
    }
    case "find_contacts": {
      const q = str(args.query);
      const type = str(args.type)?.toUpperCase();
      const where: Record<string, unknown> = {};
      const and: Record<string, unknown>[] = [];
      if (q) {
        and.push({ OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] });
      }
      if (type && ["BUYER", "SELLER", "TENANT", "LANDLORD", "VENDOR", "OTHER"].includes(type)) and.push({ type });
      if (and.length) where.AND = and;
      const limit = Math.min(nbr(args.limit) ?? 8, 25);
      const rows = await db.contact.findMany({ where, take: limit, orderBy: { createdAt: "desc" } });
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        type: c.type,
        address: c.address,
        notes: c.notes,
      }));
    }
    case "add_note": {
      const entityType = str(args.entityType)?.toUpperCase();
      const entityId = str(args.entityId);
      const content = str(args.content);
      if (!entityType || !entityId || !content) return { error: "entityType, entityId and content are required" };
      if (!ENTITY_TYPES.includes(entityType)) return { error: `entityType must be one of ${ENTITY_TYPES.join(", ")}` };
      const exists =
        entityType === "PROPERTY"
          ? await db.property.findUnique({ where: { id: entityId } })
          : entityType === "LEAD"
            ? await db.lead.findUnique({ where: { id: entityId } })
            : entityType === "DEAL"
              ? await db.deal.findUnique({ where: { id: entityId } })
              : await db.contact.findUnique({ where: { id: entityId } });
      if (!exists) return { error: `${entityType} not found` };
      const created = await db.activity.create({
        data: {
          type: "NOTE",
          content,
          entityType,
          entityId,
          propertyId: entityType === "PROPERTY" ? entityId : undefined,
          leadId: entityType === "LEAD" ? entityId : undefined,
          dealId: entityType === "DEAL" ? entityId : undefined,
          contactId: entityType === "CONTACT" ? entityId : undefined,
        },
      });
      return { id: created.id, note: content, entityType, entityId };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/** Human-readable line for the chat UI's "actions taken" list. */
export function describeAction(name: string, args: Record<string, unknown>): string {
  const s = (k: string) => (args[k] ? String(args[k]) : "");
  switch (name) {
    case "search_properties":
      return `Searched properties${s("query") ? ` for “${s("query")}”` : ""}${s("maxPrice") ? ` under ${formatCurrency(Number(s("maxPrice")))}` : ""}`;
    case "get_property":
      return "Fetched property details";
    case "portfolio_summary":
      return "Summarized the property portfolio";
    case "summarize_leads":
      return "Summarized leads";
    case "list_leads":
      return "Listed leads";
    case "update_lead_status":
      return `Moved lead to ${s("status")}`;
    case "summarize_deals":
      return "Summarized deals";
    case "list_deals":
      return "Listed deals";
    case "summarize_tasks":
      return "Summarized tasks";
    case "create_task":
      return `Created task “${s("title")}”`;
    case "complete_task":
      return "Marked a task complete";
    case "find_contacts":
      return "Searched contacts";
    case "add_note":
      return `Added a note to ${s("entityType").toLowerCase()}`;
    default:
      return `Ran ${name}`;
  }
}

export function formatToolResultForLog(result: ToolResult): string {
  return JSON.stringify(result).slice(0, 4000);
}

export { formatCurrency, formatDate };
