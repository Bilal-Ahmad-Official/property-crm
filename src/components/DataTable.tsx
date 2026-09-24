"use client";

import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return <>{empty ?? <div className="px-4 py-10 text-center text-sm text-slate-500">No records found.</div>}</>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className={cn("whitespace-nowrap px-4 py-3 font-semibold", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-slate-100 last:border-0 hover:bg-slate-50/70",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
