"use client";

import { Card, PageHeader, Spinner, StatCard } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { Building2, DollarSign, Handshake, TrendingUp, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const RevenueChart = dynamic(() => import("@/components/charts").then((m) => m.RevenueBar), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});
const StageChart = dynamic(() => import("@/components/charts").then((m) => m.StageBar), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});
const FunnelChart = dynamic(() => import("@/components/charts").then((m) => m.FunnelBar), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});
const TypeChart = dynamic(() => import("@/components/charts").then((m) => m.TypePie), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />,
});

type Data = {
  kpis: {
    totalProperties: number;
    portfolioValue: number;
    openLeads: number;
    wonLeads: number;
    totalLeads: number;
    openDeals: number;
    pipelineValue: number;
    pipelineCommission: number;
    wonRevenueThisYear: number;
    wonValueThisYear: number;
    wonDealsThisYear: number;
  };
  revenueByMonth: { month: string; revenue: number; deals: number }[];
  leadFunnel: { status: string; count: number }[];
  propertiesByType: { type: string; count: number }[];
  dealsByStage: { stage: string; count: number; value: number }[];
  topAgents: { id: string; name: string; deals: number; won: number; wonValue: number }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard");
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load reports");
        setData(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reports");
      }
    })();
  }, []);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const k = data.kpis;
  const conversion = k.totalLeads > 0 ? Math.round((k.wonLeads / k.totalLeads) * 100) : 0;
  const commissionRate = k.wonValueThisYear > 0 ? ((k.wonRevenueThisYear / k.wonValueThisYear) * 100).toFixed(1) : "0";

  return (
    <div>
      <PageHeader title="Reports" subtitle="Portfolio, pipeline and performance analytics" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio value"
          value={formatCurrency(k.portfolioValue, true)}
          hint={`${k.totalProperties} properties tracked`}
          icon={<Building2 size={18} />}
        />
        <StatCard
          label="Open pipeline"
          value={formatCurrency(k.pipelineValue, true)}
          hint={`${k.openDeals} open deals · ${formatCurrency(k.pipelineCommission, true)} commission`}
          icon={<Handshake size={18} />}
          accent="amber"
        />
        <StatCard
          label="Commission won (YTD)"
          value={formatCurrency(k.wonRevenueThisYear, true)}
          hint={`${k.wonDealsThisYear} deals · ${commissionRate}% avg rate`}
          icon={<DollarSign size={18} />}
          accent="emerald"
        />
        <StatCard
          label="Lead conversion"
          value={`${conversion}%`}
          hint={`${k.wonLeads} won of ${k.totalLeads} all-time leads`}
          icon={<TrendingUp size={18} />}
          accent="violet"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Commission earned (last 6 months)</h3>
          <RevenueChart data={data.revenueByMonth} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Deal value by stage</h3>
          <StageChart data={data.dealsByStage} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Lead pipeline funnel</h3>
          <FunnelChart data={data.leadFunnel} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Listings by type</h3>
          <TypeChart data={data.propertiesByType} />
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users size={15} className="text-brand-600" />
          <h3 className="text-sm font-semibold">Agent performance (all-time)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Deals</th>
                <th className="px-4 py-3 font-semibold">Won</th>
                <th className="px-4 py-3 font-semibold">Won value</th>
              </tr>
            </thead>
            <tbody>
              {data.topAgents.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">{a.deals}</td>
                  <td className="px-4 py-3">{a.won}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(a.wonValue, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
