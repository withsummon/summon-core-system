/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ProjectIcon } from "@plane/propel/icons";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { Avatar } from "@plane/ui";
import { exportCSV } from "../export";
import { InsightTable } from "../insight-table";
import { readTasks, type TaskCounts } from "../analytics-wrapper";
import { statusLabels } from "../total-insights";
declare module "@tanstack/react-table" {
  // eslint-disable-next-line no-unused-vars -- TanStack declaration retains both native type parameters.
  interface ColumnMeta<TData extends RowData, TValue> {
    export: { key: string; value: (row: Row<TData>) => string | number; label?: string };
  }
}
function countColumns<T extends { counts: TaskCounts }>(): ColumnDef<T>[] {
  return (["backlog", "in_progress", "todo", "done", "cancelled"] satisfies (keyof typeof statusLabels)[]).map(
    (key) => ({
      id: key,
      accessorFn: (row) => row.counts[key],
      header: () => <div className="text-right">{statusLabels[key]}</div>,
      cell: ({ row }) => <div className="text-right">{row.original.counts[key]}</div>,
      meta: { export: { key: statusLabels[key], value: (row) => row.original.counts[key] } },
    })
  );
}
export default function WorkItemsInsightTable({
  data,
  isLoading,
  workspaceSlug,
  focus,
}: {
  data: Awaited<ReturnType<typeof readTasks>> | null;
  isLoading: boolean;
  workspaceSlug: string;
  focus: boolean;
}) {
  const projectColumns = useMemo<ColumnDef<NonNullable<typeof data>["projects"][number]>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.project.name,
        header: "Project",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.project.logo ? (
              <Logo logo={row.original.project.logo} size={18} />
            ) : (
              <ProjectIcon className="size-4" />
            )}
            {row.original.project.name}
          </div>
        ),
        meta: { export: { key: "Project", value: (row) => row.original.project.name } },
      },
      ...countColumns<NonNullable<typeof data>["projects"][number]>(),
    ],
    []
  );
  const assigneeColumns = useMemo<ColumnDef<NonNullable<typeof data>["assignees"][number]>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => (row.key === "none" ? "Unassigned" : (row.person?.name ?? "Unavailable member")),
        header: "Assignee",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.person?.avatar ? (
              <AuthenticatedAssetImage
                asset={row.original.person.avatar}
                alt={row.original.person.name}
                compactName={row.original.person.name}
                className="size-6 rounded-full"
              />
            ) : (
              <Avatar name={row.original.person?.name ?? "Unassigned"} size={24} shape="circle" />
            )}
            {row.original.key === "none" ? "Unassigned" : (row.original.person?.name ?? "Unavailable member")}
          </div>
        ),
        meta: {
          export: {
            key: "Assignee",
            value: (row) =>
              row.original.key === "none" ? "Unassigned" : (row.original.person?.name ?? "Unavailable member"),
          },
        },
      },
      ...countColumns<NonNullable<typeof data>["assignees"][number]>(),
    ],
    []
  );
  return focus ? (
    <InsightTable
      data={data?.assignees}
      isLoading={isLoading}
      columns={assigneeColumns}
      headerText="Assignees"
      onExport={(rows) => exportCSV(rows, assigneeColumns, workspaceSlug)}
    />
  ) : (
    <InsightTable
      data={data?.projects}
      isLoading={isLoading}
      columns={projectColumns}
      headerText="Projects"
      onExport={(rows) => exportCSV(rows, projectColumns, workspaceSlug)}
    />
  );
}
