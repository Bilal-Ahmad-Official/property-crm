"use client";

import RichText from "@/components/RichText";
import { Badge, Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  ArrowUpRight,
  Building2,
  DollarSign,
  Handshake,
  Sparkles,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

const RevenueChart = dynamic(() => import("@/components/charts").then((m) => m.RevenueBar), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});
const StatusChart = dynamic(() => import("@/components/charts").then((m) => m.StatusPie), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});
const FunnelChart = dynamic(() => import("@/components/charts").then((m) => m.FunnelBar), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});

type DashboardData = {
  kpis: {
    activeListings: number;
    availableProperties: number;
    soldProperties: number;
    rentedProperties: number;
    totalProperties: number;
    portfolioValue: number;
    openLeads: number;
    wonLeads: number;
    totalLeads: number;
    totalContacts: number;
    openDeals: number;
    pipelineValue: number;
    pipelineCommission: number;
    wonRevenueThisYear: number;
    wonDealsThisYear: number;
    tasksDue: number;
  };
  revenueByMonth: { month: string; revenue: number; deals: number }[];
  leadFunnel: { status: string; count: number }[];
  propertiesByStatus: { status: string; count: number }[];
  propertiesByType: { type: string; count: number }[];
  topAgents: { id: string; name: string; deals: number; won: number; wonValue: number }[];
  upcomingTasks: { id: string; title: string; dueDate: string | null; priority: string; status: string; assignee: string | null }[];
  recentActivities: { id: string; type: string; content: string; entityType: string; entityId: string; user: string | null; createdAt: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, meRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/auth/me"),
        ]);
        const d = await dRes.json();
        const meData = await meRes.json();
        if (!dRes.ok) throw new Error(d.error || "Failed to load dashboard");
        setData(d);
        setMe(meData.user);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const k = data.kpis;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader
        title={`${greeting}${me ? `, ${me.name.split(" ")[0]}` : ""}`}
        subtitle="Here's what's happening across your portfolio today."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active listings"
          value={k.activeListings}
          hint={`${k.availableProperties} available · ${k.soldProperties} sold · ${k.rentedProperties} rented`}
          icon={<Building2 size={18} />}
          accent="brand"
        />
        <StatCard
          label="Open leads"
          value={k.openLeads}
          hint={`${k.wonLeads} won · ${k.totalLeads} total all-time`}
          icon={<Users size={18} />}
          accent="violet"
        />
        <StatCard
          label="Pipeline value"
          value={formatCurrency(k.pipelineValue, true)}
          hint={`${k.openDeals} open deals · ${formatCurrency(k.pipelineCommission, true)} commission`}
          icon={<Handshake size={18} />}
          accent="amber"
        />
        <StatCard
          label="Commission won (YTD)"
          value={formatCurrency(k.wonRevenueThisYear, true)}
          hint={`${k.wonDealsThisYear} closed deals`}
          icon={<DollarSign size={18} />}
          accent="emerald"
        />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Commission earned (last 6 months)</h3>
            <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              Reports <ArrowUpRight size={12} />
            </Link>
          </div>
          <RevenueChart data={data.revenueByMonth} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Listings by status</h3>
          <StatusChart data={data.propertiesByStatus} />
        </Card>
      </div>

      {/* Funnel + tasks */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lead pipeline</h3>
            <Link href="/leads" className="text-xs font-medium text-brand-600 hover:underline">
              View leads
            </Link>
          </div>
          <FunnelChart data={data.leadFunnel} />
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Upcoming tasks</h3>
            <Link href="/tasks" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.upcomingTasks.length === 0 ? (
            <EmptyState title="No open tasks" hint="All caught up — create tasks or ask Aria to schedule follow-ups." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcomingTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      Due {formatDate(t.dueDate)}
                      {t.assignee ? ` · ${t.assignee}` : ""}
                    </p>
                  </div>
                  <Badge value={t.priority} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Ask Aria + activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white xl:col-span-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <h3 className="text-sm font-semibold">Ask Aria</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/80">
            Your AI assistant knows every module. Try the floating Aria button, or open the full chat:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-white/90">
            <li>· “Show available properties under $900k”</li>
            <li>· “Which leads are in negotiation?”</li>
            <li>· “Remind me to call Michael tomorrow”</li>
          </ul>
          <Link
            href="/chat"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
          >
            Open AI Assistant <ArrowUpRight size={12} />
          </Link>
        </Card>
        <Card className="p-5 xl:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
          {data.recentActivities.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-3">
              {data.recentActivities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">
                      <RichText text={a.content} />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {a.user ?? "System"} · {formatDateTime(a.createdAt)} · {a.entityType.toLowerCase()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
