"use client";

import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { cn, formatDate, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, titleCase } from "@/lib/utils";
import { CalendarClock, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
  type: string;
  relatedType?: string | null;
  relatedId?: string | null;
  assignedTo?: { id: string; name: string } | null;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  status: "PENDING",
  type: "FOLLOW_UP",
  assignedToId: "",
};

const TABS = [
  { key: "", label: "All open" },
  { key: "overdue", label: "Overdue" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "overdue") params.set("overdue", "true");
      else if (tab) params.set("status", tab);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tasks");
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users || [])).catch(() => {});
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      priority: t.priority,
      status: t.status,
      type: t.type,
      assignedToId: t.assignedTo?.id || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, dueDate: form.dueDate || null, assignedToId: form.assignedToId || null };
      const res = await fetch(editing ? `/api/tasks/${editing.id}` : "/api/tasks", {
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

  async function toggleStatus(task: Task) {
    const next = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function remove() {
    if (!deleteTarget) return;
    await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const now = new Date();
  const isOverdue = (t: Task) =>
    t.dueDate && new Date(t.dueDate) < now && (t.status === "PENDING" || t.status === "IN_PROGRESS");

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Follow-ups, viewings, calls and paperwork across every module"
        actions={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add task
          </Button>
        }
      />

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      <Card className="mb-4 flex flex-wrap gap-1 p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition",
              tab === t.key ? "bg-brand-600 text-white" : "hover:bg-slate-100"
            )}
          >
            {t.label}
          </button>
        ))}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListTodo size={36} />} title="No tasks here" hint="Add a task, or ask Aria in chat: “remind me to follow up on leads tomorrow”." />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className={cn("p-4", t.status === "COMPLETED" && "opacity-60")}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleStatus(t)}
                  title={t.status === "COMPLETED" ? "Reopen" : "Mark complete"}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                    t.status === "COMPLETED" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-brand-500"
                  )}
                >
                  {t.status === "COMPLETED" ? <span className="text-[10px]">✓</span> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-medium", t.status === "COMPLETED" && "line-through")}>{t.title}</p>
                    <Badge value={t.priority} />
                    <Badge value={t.status} />
                    <Badge value={t.type} />
                  </div>
                  {t.description ? <p className="mt-1 text-xs text-slate-500">{t.description}</p> : null}
                  <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {t.dueDate ? (
                      <span className={cn("flex items-center gap-1", isOverdue(t) && "font-semibold text-red-500")}>
                        <CalendarClock size={12} />
                        {isOverdue(t) ? "Overdue — " : "Due "}
                        {formatDate(t.dueDate)}
                      </span>
                    ) : (
                      <span>No due date</span>
                    )}
                    {t.assignedTo ? <span>· {t.assignedTo.name}</span> : null}
                    {t.relatedType ? <span>· linked to {titleCase(t.relatedType)}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => openEdit(t)} className="rounded-md p-1.5 text-slate-400 hover:text-brand-600" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(t)} className="rounded-md p-1.5 text-slate-400 hover:text-red-600" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit task" : "Add task"}>
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Call Michael Brown about Marina View" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={set("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due date</label>
              <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={set("priority")}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{titleCase(p)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={set("status")}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{titleCase(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={set("type")}>
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{titleCase(t)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Assigned to</label>
            <select className="input" value={form.assignedToId} onChange={set("assignedToId")}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : null}
            {editing ? "Save changes" : "Add task"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete task"
        message={`Delete task “${deleteTarget?.title}”? This cannot be undone.`}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
