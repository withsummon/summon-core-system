/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { ArrowRight } from "lucide-react";
import type { Doc } from "@summon/convex/data-model";
export function RecentActivityCard({
  jobs,
  onViewAllActivity,
  onPreview,
}: {
  jobs: Doc<"automationJobs">[];
  onViewAllActivity: () => void;
  onPreview: (job: Doc<"automationJobs">) => void;
}) {
  return (
    <div className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primary">Recent Activity</h2>
        <button
          type="button"
          onClick={onViewAllActivity}
          className="text-xs flex items-center gap-1 font-medium text-accent-primary"
        >
          View all activity
          <ArrowRight size={13} />
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {jobs.slice(0, 5).map((job) => (
          <button
            type="button"
            key={job._id}
            onClick={() => onPreview(job)}
            className="flex w-full items-start gap-3 text-left"
          >
            <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-full bg-accent-primary" />
            <span className="min-w-0">
              <span className="text-xs block truncate font-medium text-primary">{job.title}</span>
              <span className="mt-0.5 block text-[11px] text-secondary">
                {job.publishedDocumentId ? "Published" : job.status} ·{" "}
                {new Date(job.completedAt ?? job._creationTime).toLocaleString()}
              </span>
            </span>
          </button>
        ))}
        {!jobs.length && <p className="text-xs text-secondary">Your generation activity will appear here.</p>}
      </div>
    </div>
  );
}
