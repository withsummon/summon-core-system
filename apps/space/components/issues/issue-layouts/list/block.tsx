import { Link, useSearchParams, useParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { usePublish } from "@/hooks/store/publish";
import { IssueProperties } from "../properties/all-properties";

export function IssueBlock({
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
    <div
      className={cn(
        "group/list-block relative flex min-h-11 flex-col gap-3 border border-transparent border-b-subtle p-3 pl-1.5 text-13 transition-colors hover:bg-layer-transparent-hover md:flex-row md:items-center",
        { "border-accent-strong!": params.get("peekId") === task._id }
      )}
    >
      <div className="flex w-full truncate">
        <div className="flex grow items-center gap-0.5 truncate">
          <span className="shrink-0 px-4 text-11 font-medium text-tertiary">
            {publication?.project.identifier}-{task.sequence}
          </span>
          <Link
            id={`issue-${task._id}`}
            to={`?${next}`}
            className="w-full cursor-pointer truncate text-13 text-primary"
          >
            <Tooltip tooltipContent={task.title} position="top-start">
              <p className="truncate">{task.title}</p>
            </Tooltip>
          </Link>
        </div>
      </div>
      <IssueProperties
        task={task}
        className="relative flex flex-wrap items-center gap-2 whitespace-nowrap md:shrink-0"
      />
    </div>
  );
}
