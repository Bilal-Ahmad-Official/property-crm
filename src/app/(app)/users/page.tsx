"use client";

import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { cn, ROLES, titleCase } from "@/lib/utils";
import { Power, ShieldAlert, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "SALES" };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  const isAdmin = me?.role === "ADMIN";
  const canManage = Boolean(me && isAdmin);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user)).catch(() => {});
  }, []);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  async function createUser() {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setModalOpen(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setModalOpen(false);
      setError(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(row: UserRow, patch: { name?: string; role?: string; isActive?: boolean }) {
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setError(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    }
  }

  async function toggleActive(row: UserRow) {
    if (row.isActive) {
      setDeactivateTarget(row); // deactivation is confirmed via dialog
      return;
    }
    await updateUser(row, { isActive: true });
  }

  async function deactivate() {
    if (!deactivateTarget) return;
    await updateUser(deactivateTarget, { isActive: false });
    setDeactivateTarget(null);
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="User administration — accounts, roles and access"
        actions={
          canManage ? (
            <Button onClick={openAdd}>
              <UserPlus size={15} /> Add user
            </Button>
          ) : null
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      {me && !isAdmin && !forbidden ? (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          You have view-only access — only administrators can manage users.
        </div>
      ) : null}

      {forbidden ? (
        <EmptyState
          icon={<ShieldAlert size={36} />}
          title="Administrator access required"
          hint="Only administrators can manage users. Ask an administrator to update accounts and roles."
        />
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="No users found" hint="Add a user to get started." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage ? <th className="px-4 py-3 text-right font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {self ? <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge value={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={u.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              className="input w-32 text-xs"
                              value={u.role}
                              disabled={self}
                              title={self ? "You cannot change your own role" : "Change role"}
                              onChange={(e) => updateUser(u, { role: e.target.value })}
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{titleCase(r)}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => toggleActive(u)}
                              disabled={self}
                              title={self ? "You cannot change your own account" : u.isActive ? "Deactivate" : "Activate"}
                              className={cn(
                                "rounded-md p-1.5 text-slate-400 transition",
                                u.isActive ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-emerald-50 hover:text-emerald-600",
                                self && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400"
                              )}
                            >
                              <Power size={14} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add user">
        <div className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="name@company.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" value={form.password} onChange={set("password")} placeholder="At least 6 characters" />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{titleCase(r)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={createUser} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            Add user
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate user"
        message={`Deactivate “${deactivateTarget?.name}”? They will no longer be able to sign in until reactivated.`}
        confirmLabel="Deactivate"
        onConfirm={deactivate}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  );
}
