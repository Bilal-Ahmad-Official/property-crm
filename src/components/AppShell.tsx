"use client";

import { cn, titleCase } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  Bot,
  Building2,
  ClipboardList,
  FileSignature,
  Handshake,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPin,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; roles?: string[] };

// Grouped navigation (SRS §10: clear navigation between functional areas)
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
      { href: "/chat", label: "AI Assistant", icon: Bot },
    ],
  },
  {
    label: "Sales & Customers",
    items: [
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/contacts", label: "Customers", icon: MapPin },
      { href: "/bookings", label: "Bookings", icon: FileSignature },
      { href: "/deals", label: "Deals", icon: Handshake },
      { href: "/sales", label: "Sales", icon: Tag },
    ],
  },
  {
    label: "Transactions",
    items: [
      { href: "/purchases", label: "Purchases", icon: Building2 },
      { href: "/payments", label: "Payments & Receipts", icon: Receipt },
      { href: "/transfers", label: "Property Transfers", icon: ArrowLeftRight },
      { href: "/buybacks", label: "Buy-Backs", icon: Wallet },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/charges", label: "Charges & Notices", icon: ClipboardList },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "MANAGER", "FINANCE"] },
      { href: "/users", label: "Users", icon: ShieldCheck, roles: ["ADMIN"] },
      { href: "/settings", label: "Configuration", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

export default function AppShell({
  user,
  children,
}: {
  user: { id: string; name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const current = [...allItems].sort((a, b) => b.href.length - a.href.length).find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-5 py-5">
        <img src="/logo.png" alt="PropCore — Real Estate Management Suite" className="h-14 w-auto" />
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{titleCase(user.role)}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-60 bg-white shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen w-full flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Menu size={18} />
            </button>
            <h2 className="text-sm font-semibold text-slate-700">{current?.label ?? "PropCore"}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">{user.email}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
