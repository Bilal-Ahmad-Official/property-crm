"use client";

import { Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { ArrowLeft, Bath, BedDouble, Building2, CalendarDays, Ruler, Send, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PropertyDetail = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  listingType: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  address: string;
  city: string;
  state?: string | null;
  zip?: string | null;
  imageUrl?: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; email: string } | null;
  _count?: { leads: number; deals: number };
};

type Activity = {
  id: string;
  type: string;
  content: string;
  user?: string | null;
  createdAt: string;
};

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/properties/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setProperty(data.property);
      setActivities(data.activities);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load property");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    if (!note.trim() || !id) return;
    setSending(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "PROPERTY", entityId: id, content: note.trim(), type: "NOTE" }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add note");
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <div>
        <Link href="/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to properties
        </Link>
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      </div>
    );
  }
  if (!property) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div>
      <Link href="/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft size={14} /> Back to properties
      </Link>
      <PageHeader
        title={property.title}
        subtitle={`${property.address}, ${property.city}${property.state ? `, ${property.state}` : ""} ${property.zip || ""}`}
        actions={
          <p className="text-xl font-bold text-brand-700">
            {property.listingType === "RENT" ? `${formatCurrency(property.price)}/mo` : formatCurrency(property.price)}
          </p>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="relative h-72 w-full bg-slate-200 sm:h-96">
              {property.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={property.imageUrl} alt={property.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Building2 size={48} />
                </div>
              )}
              <div className="absolute left-3 top-3 flex gap-2">
                <Badge value={property.status} className="!bg-white/95 shadow-sm" />
                <Badge value={property.listingType} className="!bg-white/95 shadow-sm" />
                <Badge value={property.type} className="!bg-white/95 shadow-sm" />
              </div>
            </div>
            <div className="p-5">
              {property.description ? (
                <p className="text-sm leading-relaxed text-slate-600">{property.description}</p>
              ) : (
                <p className="text-sm italic text-slate-400">No description added yet.</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: <BedDouble size={15} />, label: "Bedrooms", value: property.bedrooms || "—" },
                  { icon: <Bath size={15} />, label: "Bathrooms", value: property.bathrooms || "—" },
                  { icon: <Ruler size={15} />, label: "Area", value: `${property.area.toLocaleString("en-US")} sq ft` },
                  { icon: <CalendarDays size={15} />, label: "Listed", value: formatDate(property.createdAt) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      {s.icon} {s.label}
                    </div>
                    <p className="mt-1 text-sm font-semibold">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Details</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Status</dt>
                <dd><Badge value={property.status} /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Listing</dt>
                <dd><Badge value={property.listingType} /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Agent</dt>
                <dd className="font-medium">{property.owner?.name ?? "Unassigned"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Open leads</dt>
                <dd className="font-medium">{property._count?.leads ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Deals</dt>
                <dd className="font-medium">{property._count?.deals ?? 0}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Activity & notes</h3>
            <div className="mt-3 flex gap-2">
              <input
                className="input"
                placeholder="Add a note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
              />
              <Button onClick={addNote} disabled={sending || !note.trim()} size="sm" className="shrink-0">
                <Send size={13} />
              </Button>
            </div>
            <ul className="mt-4 space-y-3">
              {activities.length === 0 ? (
                <li className="text-xs italic text-slate-400">No activity yet — add the first note above.</li>
              ) : (
                activities.map((a) => (
                  <li key={a.id} className="flex gap-2.5 border-l-2 border-slate-100 pl-3">
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug text-slate-700">{a.content}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {titleCase(a.type)} · {a.user ?? "System"} · {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
