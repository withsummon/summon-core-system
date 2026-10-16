/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Check, CircleAlert, Eye, MoreHorizontal } from "lucide-react";
import type { ISummonAutomationJob } from "@plane/types";
import { automationInputValue, automationJobPath } from "./automation-form";
import { formatSummonDate } from "@/components/summon/date";
import { SummonSkeletonBlock, SummonSkeletonText } from "@/components/summon/skeleton";
import { jobStatus, templateLabel, templateVisual } from "./automation-display";

/** Column labels: the desktop header and the phone row label read from the same entry. */
const JOB_COLUMNS = {
  document: "Document",
  type: "Type",
  context: "Context",
  engine: "Engine",
  created: "Created At",
  status: "Status",
  actions: "Actions",
} as const;

function JobStatusIcon({ status }: { status: ISummonAutomationJob["status"] }) {
  if (status === "completed") return <Check className="size-3" />;
  if (status === "failed") return <CircleAlert className="size-3" />;
  return null;
}

function AutomationJobRow(props: { job: ISummonAutomationJob; workspaceSlug: string; projectName: string }) {
  const { job, workspaceSlug } = props;
  const status = jobStatus(job);
  const { Icon, tone: iconTone } = templateVisual(job.type);
  const title = automationInputValue(job.input, "title") || templateLabel(job.type);
  return (
    <tr className="hover:bg-layer-1/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}>
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="max-w-56 truncate text-xs font-medium text-primary">{title}</p>
            <p className="mt-0.5 max-w-56 truncate text-12 text-tertiary">
              {automationInputValue(job.input, "brief") || "Generated from verified workspace context"}
            </p>
          </div>
        </div>
      </td>
      <td data-label={JOB_COLUMNS.type} className="px-3 py-3">
        <span className="rounded-md bg-accent-subtle px-2 py-1 text-12 font-medium text-accent-primary">
          {templateLabel(job.type)}
        </span>
      </td>
      <td data-label={JOB_COLUMNS.context} className="max-w-48 truncate px-3 py-3 text-12 text-secondary">
        {props.projectName}
      </td>
      <td data-label={JOB_COLUMNS.engine} className="px-3 py-3 text-12 text-secondary">
        {job.provider || "Pending"}
      </td>
      <td data-label={JOB_COLUMNS.created} className="px-3 py-3 text-12 whitespace-nowrap text-secondary">
        {formatSummonDate(job.created_at, "")}
      </td>
      <td data-label={JOB_COLUMNS.status} className="px-3 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-12 font-medium ${status.className}`}
        >
          <JobStatusIcon status={job.status} />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 max-md:justify-end max-md:pt-2">
        <div className="flex justify-end gap-1.5">
          <Link
            href={automationJobPath(workspaceSlug, job.id)}
            aria-label={`View ${title}`}
            className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
          >
            <Eye className="size-3.5" />
          </Link>
          <Link
            href={automationJobPath(workspaceSlug, job.id)}
            aria-label="More document actions"
            className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
          >
            <MoreHorizontal className="size-3.5" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function AutomationJobsTable(props: {
  jobs: ISummonAutomationJob[];
  workspaceSlug: string;
  projectNames: Map<string, string>;
}) {
  return (
    <JobsTableFrame>
      {props.jobs.map((job) => (
        <AutomationJobRow
          key={job.id}
          job={job}
          workspaceSlug={props.workspaceSlug}
          projectName={job.project ? (props.projectNames.get(job.project) ?? job.project) : "No project"}
        />
      ))}
    </JobsTableFrame>
  );
}

/** The jobs table with placeholder rows, while jobs load. */
export function AutomationJobsTableSkeleton() {
  return (
    <JobsTableFrame>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index} aria-hidden>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2.5">
              <SummonSkeletonBlock className="size-8 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <SummonSkeletonText className="text-xs font-medium" width="w-40" />
                <SummonSkeletonText className="mt-0.5 text-12" width="w-52" />
              </div>
            </div>
          </td>
          <td className="px-3 py-3">
            <SummonSkeletonText className="py-1 text-12" width="w-16" />
          </td>
          <td className="px-3 py-3">
            <SummonSkeletonText className="text-12" width="w-20" />
          </td>
          <td className="px-3 py-3">
            <SummonSkeletonText className="text-12" width="w-14" />
          </td>
          <td className="px-3 py-3">
            <SummonSkeletonText className="text-12" width="w-20" />
          </td>
          <td className="px-3 py-3">
            <SummonSkeletonText className="py-1 text-12" width="w-16" />
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-1.5">
              <SummonSkeletonBlock className="size-8 rounded-lg" />
              <SummonSkeletonBlock className="size-8 rounded-lg" />
            </div>
          </td>
        </tr>
      ))}
    </JobsTableFrame>
  );
}

function JobsTableFrame(props: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-stack w-full text-left md:min-w-[820px]">
        <thead className="border-b border-subtle bg-layer-1/40 text-12 font-semibold text-tertiary">
          <tr>
            <th className="px-4 py-3">{JOB_COLUMNS.document}</th>
            <th className="px-3 py-3">{JOB_COLUMNS.type}</th>
            <th className="px-3 py-3">{JOB_COLUMNS.context}</th>
            <th className="px-3 py-3">{JOB_COLUMNS.engine}</th>
            <th className="px-3 py-3">{JOB_COLUMNS.created}</th>
            <th className="px-3 py-3">{JOB_COLUMNS.status}</th>
            <th className="px-4 py-3 text-right">{JOB_COLUMNS.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">{props.children}</tbody>
      </table>
    </div>
  );
}
