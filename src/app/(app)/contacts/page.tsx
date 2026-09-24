"use client";

import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { CONTACT_TYPES, formatDate, titleCase } from "@/lib/utils";
import { Mail, MapPin, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Contact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type: string;
  notes?: string | null;
  address?: string | null;
  createdAt: string;
  _count?: { leads: number; deals: number };
};

const EMPTY_FORM = { name: "", email: "", phone: "", type: "BUYER", address: "", notes: "" };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contacts");
      setContacts(data.contacts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      type: c.type,
      address: c.address || "",
      notes: c.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/contacts/${editing.id}` : "/api/contacts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    await fetch(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? "" : "s"} — clients, owners and partners`}
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add contact
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <input
          className="input sm:max-w-xs"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="No contacts found" hint="Add a contact or clear the filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {contacts.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                  {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <Badge value={c.type} />
                  </div>
                  <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                    {c.email ? (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={11} /> {c.email}
                      </p>
                    ) : null}
                    {c.phone ? (
                      <p className="flex items-center gap-1.5">
                        <Phone size={11} /> {c.phone}
                      </p>
                    ) : null}
                    {c.address ? (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin size={11} /> {c.address}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              {c.notes ? <p className="mt-3 line-clamp-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">{c.notes}</p> : null}
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
                <span>
                  {c._count?.leads ?? 0} lead{(c._count?.leads ?? 0) === 1 ? "" : "s"} · {c._count?.deals ?? 0} deal{(c._count?.deals ?? 0) === 1 ? "" : "s"} · {formatDate(c.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <button onClick={() => openEdit(c)} className="rounded-md p-1 hover:bg-slate-100 hover:text-brand-600" title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(c)} className="rounded-md p-1 hover:bg-red-50 hover:text-red-600" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit contact" : "Add contact"}>
        <div className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={set("type")}>
                {CONTACT_TYPES.map((t) => (
                  <option key={t} value={t}>{titleCase(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.address} onChange={set("address")} placeholder="City, State" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Add contact"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete contact"
        message={`Delete contact “${deleteTarget?.name}”? Linked leads and deals will be detached but not deleted.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
