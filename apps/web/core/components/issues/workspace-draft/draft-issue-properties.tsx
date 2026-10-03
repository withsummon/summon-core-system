/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Popover } from "@plane/propel/popover";
import { DueDatePropertyIcon, StartDatePropertyIcon } from "@plane/propel/icons";
import { cn, renderFormattedDate } from "@plane/utils";
import { TaskProperties } from "@/components/convex-core/tasks/task-properties";
import { DraftRelationships } from "@/components/convex-core/tasks/drafts/relationships";
import { taskStatusOptions } from "@/components/convex-core/tasks/options";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
type Draft = FunctionReturnType<typeof api.tasks.drafts.index.list>["page"][number];

export function DraftIssueProperties({ issue, className }: { issue: Draft; className: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.tasks.drafts.index.save);
  const leave = useCallback(() => setOpen(false), []);
  const release = useReloadConfirmations(pending, "Draft properties are still saving.", leave, pending);
  const update = async (
    values: Pick<
      FunctionArgs<typeof api.tasks.drafts.index.save>,
      "status" | "properties" | "parent" | "cycle" | "modules"
    >
  ) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await save({
        draftId: issue._id,
        expectedContentRevision: issue.contentRevision,
        projectId: issue.projectId,
        title: issue.title,
        html: issue.html,
        ...values,
      });
      release();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  if (issue.deletedAt !== null) return null;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <Popover.Button
        className={cn(className, "text-11")}
        aria-label={`Edit properties of ${issue.title || "Untitled draft"}`}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <span className="max-w-40 truncate rounded-sm border border-subtle px-1.5">
          {issue.status ? taskStatusOptions[issue.status].label : "Project default"}
        </span>
        <span className="rounded-sm border border-subtle px-1.5 capitalize">{issue.properties.priority}</span>
        <span className="inline-flex items-center gap-1 text-secondary">
          <StartDatePropertyIcon className="size-3" />
          {issue.properties.startDate ? renderFormattedDate(issue.properties.startDate) : "Start date"}
        </span>
        <span className="inline-flex items-center gap-1 text-secondary">
          <DueDatePropertyIcon className="size-3" />
          {issue.properties.targetDate ? renderFormattedDate(issue.properties.targetDate) : "Due date"}
        </span>
        {!!issue.properties.assigneeIds.length && <span>{issue.properties.assigneeIds.length} assignees</span>}
        {!!issue.properties.labelIds.length && <span>{issue.properties.labelIds.length} labels</span>}
        {!!issue.modules.length && <span>{issue.modules.length} modules</span>}
        {issue.cycle && <span>Cycle</span>}
      </Popover.Button>
      <Popover.Panel
        align="end"
        positionerClassName="z-[120]"
        className="max-h-[min(36rem,80vh)] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-subtle bg-surface-1 p-4 shadow-raised-200"
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <fieldset disabled={pending} className="space-y-4" aria-busy={pending}>
          <legend className="mb-3 text-13 font-medium">Draft properties</legend>
          <TaskProperties
            projectId={issue.projectId}
            allowDefaultState
            draft={{ ...issue.properties, status: issue.status }}
            onChange={({ status, ...properties }) =>
              void update({ status, properties, parent: issue.parent, cycle: issue.cycle, modules: issue.modules })
            }
          />
          {issue.projectId && (
            <DraftRelationships
              projectId={issue.projectId}
              draft={issue}
              onChange={(next) =>
                void update({
                  status: next.status,
                  properties: next.properties,
                  parent: next.parent,
                  cycle: next.cycle,
                  modules: next.modules,
                })
              }
            />
          )}
        </fieldset>
        {pending && (
          <p role="status" className="mt-3 text-13 text-secondary">
            Saving properties…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-13 text-danger-primary">
            {error}
          </p>
        )}
      </Popover.Panel>
    </Popover>
  );
}
