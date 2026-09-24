import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    await requireUser();

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      availableProperties,
      reservedProperties,
      soldProperties,
      rentedProperties,
      totalProperties,
      portfolioValue,
      openLeads,
      wonLeads,
      totalLeads,
      totalContacts,
      openDealsAgg,
      wonAgg,
      allDeals,
      dueTasks,
      upcomingTasks,
      recentActivities,
    ] = await Promise.all([
      db.property.count({ where: { status: "AVAILABLE" } }),
      db.property.count({ where: { status: "RESERVED" } }),
      db.property.count({ where: { status: "SOLD" } }),
      db.property.count({ where: { status: "RENTED" } }),
      db.property.count(),
      db.property.aggregate({ _sum: { price: true } }),
      db.lead.count({ where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION"] } } }),
      db.lead.count({ where: { status: "WON" } }),
      db.lead.count(),
      db.contact.count(),
      db.deal.aggregate({
        where: { stage: { in: ["OFFER_MADE", "DUE_DILIGENCE", "CONTRACT", "CLOSING"] } },
        _sum: { value: true, commission: true },
        _count: { _all: true },
      }),
      db.deal.aggregate({
        where: { stage: "CLOSED_WON", closedAt: { gte: yearStart } },
        _sum: { value: true, commission: true },
        _count: { _all: true },
      }),
      db.deal.findMany({
        where: { stage: "CLOSED_WON", closedAt: { not: null } },
        select: { closedAt: true, commission: true, value: true },
      }),
      db.task.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      db.task.findMany({
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
        take: 6,
        orderBy: { dueDate: "asc" },
        include: { assignedTo: { select: { name: true } } },
      }),
      db.activity.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
    ]);

    // Revenue by month (commission from won deals, last 6 months)
    const months: { month: string; revenue: number; deals: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: d.toLocaleDateString("en-US", { month: "short" }),
        revenue: 0,
        deals: 0,
      });
    }
    for (const deal of allDeals) {
      if (!deal.closedAt) continue;
      const idx =
        5 -
        (now.getMonth() -
          deal.closedAt.getMonth() +
          (now.getFullYear() - deal.closedAt.getFullYear()) * 12);
      if (idx >= 0 && idx <= 5) {
        months[idx].revenue += deal.commission;
        months[idx].deals += 1;
      }
    }

    const propertyTypes = await db.property.groupBy({ by: ["type"], _count: { _all: true } });
    const leadFunnel = await db.lead.groupBy({ by: ["status"], _count: { _all: true } });
    const dealStages = await db.deal.groupBy({
      by: ["stage"],
      _count: { _all: true },
      _sum: { value: true },
    });
    const agents = await db.user.findMany({
      select: {
        id: true,
        name: true,
        deals: { select: { stage: true, commission: true, value: true } },
      },
    });

    const funnelOrder = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION", "WON", "LOST"];

    return NextResponse.json({
      kpis: {
        activeListings: availableProperties + reservedProperties,
        availableProperties,
        reservedProperties,
        soldProperties,
        rentedProperties,
        totalProperties,
        portfolioValue: portfolioValue._sum.price ?? 0,
        openLeads,
        wonLeads,
        totalLeads,
        totalContacts,
        openDeals: openDealsAgg._count._all,
        pipelineValue: openDealsAgg._sum.value ?? 0,
        pipelineCommission: openDealsAgg._sum.commission ?? 0,
        wonRevenueThisYear: wonAgg._sum.commission ?? 0,
        wonValueThisYear: wonAgg._sum.value ?? 0,
        wonDealsThisYear: wonAgg._count._all,
        tasksDue: dueTasks,
        sixMonthsAgo: sixMonthsAgo.toISOString(),
      },
      revenueByMonth: months,
      leadFunnel: funnelOrder.map((status) => ({
        status,
        count: leadFunnel.find((r) => r.status === status)?._count._all ?? 0,
      })),
      propertiesByType: propertyTypes.map((r) => ({ type: r.type, count: r._count._all })),
      propertiesByStatus: [
        { status: "AVAILABLE", count: availableProperties },
        { status: "RESERVED", count: reservedProperties },
        { status: "SOLD", count: soldProperties },
        { status: "RENTED", count: rentedProperties },
      ],
      dealsByStage: ["OFFER_MADE", "DUE_DILIGENCE", "CONTRACT", "CLOSING", "CLOSED_WON", "CLOSED_LOST"].map(
        (stage) => ({
          stage,
          count: dealStages.find((r) => r.stage === stage)?._count._all ?? 0,
          value: dealStages.find((r) => r.stage === stage)?._sum.value ?? 0,
        })
      ),
      topAgents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        deals: a.deals.length,
        won: a.deals.filter((d) => d.stage === "CLOSED_WON").length,
        wonValue: a.deals.filter((d) => d.stage === "CLOSED_WON").reduce((s, d) => s + d.value, 0),
      })).sort((x, y) => y.wonValue - x.wonValue),
      upcomingTasks: upcomingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        assignee: t.assignedTo?.name ?? null,
      })),
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        type: a.type,
        content: a.content,
        entityType: a.entityType,
        entityId: a.entityId,
        user: a.user?.name ?? null,
        createdAt: a.createdAt,
      })),
    });
  });
}
