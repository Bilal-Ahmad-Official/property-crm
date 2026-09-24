"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, titleCase } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  RESERVED: "#f59e0b",
  SOLD: "#3b82f6",
  RENTED: "#8b5cf6",
  INACTIVE: "#94a3b8",
  NEW: "#3b82f6",
  CONTACTED: "#06b6d4",
  QUALIFIED: "#6366f1",
  VIEWING: "#f59e0b",
  NEGOTIATION: "#f97316",
  WON: "#10b981",
  LOST: "#ef4444",
  CLOSED_WON: "#10b981",
  CLOSED_LOST: "#ef4444",
  OFFER_MADE: "#3b82f6",
  DUE_DILIGENCE: "#f59e0b",
  CONTRACT: "#8b5cf6",
  CLOSING: "#06b6d4",
};

export function RevenueBar({ data }: { data: { month: string; revenue: number; deals: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatCurrency(v, true).replace("$", "$")}
          width={58}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Commission"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="revenue" fill="#274de6" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPie({ data }: { data: { status: string; count: number }[] }) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={filtered} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {filtered.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} listing(s)`, titleCase(String(name))]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 12, color: "#475569" }}>{titleCase(String(value))}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FunnelBar({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="status"
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => titleCase(v).slice(0, 9)}
          interval={0}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          formatter={(value) => [`${value} lead(s)`, "Count"]}
          labelFormatter={(label) => titleCase(String(label))}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#6366f1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StageBar({ data }: { data: { stage: string; count: number; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => titleCase(v).slice(0, 9)}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatCurrency(v, true)}
          width={58}
        />
        <Tooltip
          formatter={(value, _name, item) => [
            formatCurrency(Number(item?.payload?.value ?? 0)),
            `${item?.payload?.count ?? 0} deal(s)`,
          ]}
          labelFormatter={(label) => titleCase(String(label))}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
          {data.map((entry) => (
            <Cell key={entry.stage} fill={STATUS_COLORS[entry.stage] || "#6366f1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TypePie({ data }: { data: { type: string; count: number }[] }) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) return <NoData />;
  const palette = ["#274de6", "#6192f7", "#94b8fb", "#10b981", "#f59e0b", "#8b5cf6"];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={filtered} dataKey="count" nameKey="type" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {filtered.map((entry, i) => (
            <Cell key={entry.type} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} listing(s)`, titleCase(String(name))]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 12, color: "#475569" }}>{titleCase(String(value))}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function NoData() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No data yet</div>
  );
}
