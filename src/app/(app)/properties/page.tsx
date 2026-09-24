"use client";

import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { cn, formatCurrency, titleCase } from "@/lib/utils";
import { Bath, BedDouble, Building2, Grid3X3, List, MapPin, Pencil, Plus, Ruler, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Property = {
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
  owner?: { id: string; name: string } | null;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  type: "APARTMENT",
  status: "AVAILABLE",
  listingType: "SALE",
  price: "",
  bedrooms: "0",
  bathrooms: "0",
  area: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  imageUrl: "",
  featured: false,
  ownerId: "",
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [filters, setFilters] = useState({ q: "", type: "", status: "", listingType: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);
      if (filters.listingType) params.set("listingType", filters.listingType);
      const res = await fetch(`/api/properties?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load properties");
      setProperties(data.properties);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(p: Property) {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description || "",
      type: p.type,
      status: p.status,
      listingType: p.listingType,
      price: String(p.price),
      bedrooms: String(p.bedrooms),
      bathrooms: String(p.bathrooms),
      area: String(p.area),
      address: p.address,
      city: p.city,
      state: p.state || "",
      zip: p.zip || "",
      imageUrl: p.imageUrl || "",
      featured: p.featured,
      ownerId: p.owner?.id || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.title.trim() || !form.address.trim() || !form.city.trim()) {
      setError("Title, address and city are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price || 0),
        bedrooms: Number(form.bedrooms || 0),
        bathrooms: Number(form.bathrooms || 0),
        area: Number(form.area || 0),
        ownerId: form.ownerId || null,
      };
      const res = await fetch(editing ? `/api/properties/${editing.id}` : "/api/properties", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setModalOpen(false);
      setError(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    await fetch(`/api/properties/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string; type?: string; checked?: boolean } }) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? Boolean(e.target.checked) : e.target.value }));

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} listing${properties.length === 1 ? "" : "s"} in your portfolio`}
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add property
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      {/* Filters */}
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search title, city, address…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select className="input sm:w-40" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          {["APARTMENT", "HOUSE", "VILLA", "PLOT", "COMMERCIAL", "OFFICE"].map((t) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </select>
        <select className="input sm:w-40" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {["AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"].map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
        <select className="input sm:w-36" value={filters.listingType} onChange={(e) => setFilters((f) => ({ ...f, listingType: e.target.value }))}>
          <option value="">Sale & rent</option>
          <option value="SALE">For sale</option>
          <option value="RENT">For rent</option>
        </select>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
          <button
            onClick={() => setView("grid")}
            className={cn("px-2.5 py-2 text-slate-500 transition", view === "grid" && "bg-brand-600 text-white")}
            title="Grid view"
          >
            <Grid3X3 size={15} />
          </button>
          <button
            onClick={() => setView("table")}
            className={cn("px-2.5 py-2 text-slate-500 transition", view === "table" && "bg-brand-600 text-white")}
            title="Table view"
          >
            <List size={15} />
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<Building2 size={36} />}
          title="No properties found"
          hint="Try clearing filters, or add your first listing."
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {properties.map((p) => (
            <Card key={p.id} className="group overflow-hidden">
              <Link href={`/properties/${p.id}`} className="relative block h-44 w-full overflow-hidden bg-slate-200">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400">
                    <Building2 size={36} />
                  </div>
                )}
                <div className="absolute left-2.5 top-2.5 flex gap-1.5">
                  <Badge value={p.status} className="!bg-white/95 shadow-sm" />
                  <Badge value={p.listingType} className="!bg-white/95 shadow-sm" />
                </div>
                {p.featured ? (
                  <div className="absolute right-2.5 top-2.5 rounded-full bg-amber-400 p-1.5 text-white shadow-sm">
                    <Star size={12} fill="currentColor" />
                  </div>
                ) : null}
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/properties/${p.id}`} className="block truncate text-sm font-semibold hover:text-brand-600">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin size={11} /> {p.address}, {p.city}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-bold text-brand-700">
                    {p.listingType === "RENT" ? `${formatCurrency(p.price)}/mo` : formatCurrency(p.price)}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {p.bedrooms > 0 ? (
                    <span className="flex items-center gap-1">
                      <BedDouble size={13} /> {p.bedrooms} bd
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <Bath size={13} /> {p.bathrooms} ba
                  </span>
                  <span className="flex items-center gap-1">
                    <Ruler size={13} /> {p.area.toLocaleString("en-US")} sq ft
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Beds/Baths</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link href={`/properties/${p.id}`} className="font-medium hover:text-brand-600">
                        {p.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {p.address}, {p.city}
                      </p>
                    </td>
                    <td className="px-4 py-3">{titleCase(p.type)}</td>
                    <td className="px-4 py-3">
                      <Badge value={p.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {p.listingType === "RENT" ? `${formatCurrency(p.price)}/mo` : formatCurrency(p.price)}
                    </td>
                    <td className="px-4 py-3">
                      {p.bedrooms} / {p.bathrooms}
                    </td>
                    <td className="px-4 py-3">{p.owner?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit property" : "Add property"} wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Luxury Marina View Apartment" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={set("description")} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={set("type")}>
              {["APARTMENT", "HOUSE", "VILLA", "PLOT", "COMMERCIAL", "OFFICE"].map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              {["AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"].map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Listing type</label>
            <select className="input" value={form.listingType} onChange={set("listingType")}>
              <option value="SALE">For sale</option>
              <option value="RENT">For rent</option>
            </select>
          </div>
          <div>
            <label className="label">{form.listingType === "RENT" ? "Monthly rent (USD) *" : "Price (USD) *"}</label>
            <input className="input" type="number" min="0" value={form.price} onChange={set("price")} />
          </div>
          <div>
            <label className="label">Bedrooms</label>
            <input className="input" type="number" min="0" value={form.bedrooms} onChange={set("bedrooms")} />
          </div>
          <div>
            <label className="label">Bathrooms</label>
            <input className="input" type="number" min="0" value={form.bathrooms} onChange={set("bathrooms")} />
          </div>
          <div>
            <label className="label">Area (sq ft)</label>
            <input className="input" type="number" min="0" value={form.area} onChange={set("area")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address *</label>
            <input className="input" value={form.address} onChange={set("address")} />
          </div>
          <div>
            <label className="label">City *</label>
            <input className="input" value={form.city} onChange={set("city")} />
          </div>
          <div>
            <label className="label">State</label>
            <input className="input" value={form.state} onChange={set("state")} />
          </div>
          <div>
            <label className="label">ZIP</label>
            <input className="input" value={form.zip} onChange={set("zip")} />
          </div>
          <div>
            <label className="label">Assigned agent</label>
            <select className="input" value={form.ownerId} onChange={set("ownerId")}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Image URL</label>
            <input className="input" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.featured} onChange={set("featured")} className="h-4 w-4 rounded border-slate-300" />
            Feature this listing
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Add property"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete property"
        message={`Delete “${deleteTarget?.title}”? Linked leads and deals will be detached but not deleted.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
