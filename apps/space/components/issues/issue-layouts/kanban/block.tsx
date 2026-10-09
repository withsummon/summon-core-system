import { Link, useParams, useSearchParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { usePublish } from "@/hooks/store/publish";
import { IssueProperties } from "../properties/all-properties";
import { BlockReactions } from "./block-reactions";

export function KanbanIssueBlock({
  task,
}: {
  task: FunctionReturnType<typeof api.publicSharing.index.list>["page"][number];
}) {
  const { anchor } = useParams();
  const publication = usePublish(anchor ?? "");
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("peekId", task._id);
  return (
    <div className="group/kanban-block relative p-1.5">
      <div
        className={cn(
          "relative block w-full rounded-lg border border-subtle bg-layer-2 text-13 transition-all hover:bg-layer-2-hover",
          { "border-accent-strong": params.get("peekId") === task._id }
        )}
      >
        <Link id={`issue-${task._id}`} className="block w-full" to={`?${next}`}>
          <div className="space-y-2 px-3 py-2">
            <div className="line-clamp-1 text-11 text-tertiary">
              {publication?.project.identifier}-{task.sequence}
            </div>
            <div className="mb-1.5 line-clamp-1 w-full text-13 text-primary">
              <Tooltip tooltipContent={task.title}>
                <span>{task.title}</span>
              </Tooltip>
            </div>
            <IssueProperties
              task={task}
              className="flex flex-wrap items-center gap-2 pt-1.5 whitespace-nowrap text-tertiary"
            />
          </div>
        </Link>
        <BlockReactions taskId={task._id} />
      </div>
    </div>
  );
}
