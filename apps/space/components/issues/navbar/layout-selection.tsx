import { useSearchParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { SITES_ISSUE_LAYOUTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import { useIssueFilter } from "@/hooks/store/use-issue-filter";
import { IssueLayoutIcon } from "./layout-icon";

export function IssuesLayoutSelection({
  viewProps,
}: {
  viewProps: FunctionReturnType<typeof api.publicSharing.index.settings>["settings"]["viewProps"];
}) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { layout: activeLayout } = useIssueFilter();
  return (
    <div className="flex items-center gap-1 rounded-sm bg-layer-2 p-1">
      {SITES_ISSUE_LAYOUTS.filter(
        (layout) => (layout.key === "list" || layout.key === "kanban") && viewProps[layout.key]
      ).map((layout) => (
        <Tooltip key={layout.key} tooltipContent={t(layout.titleTranslationKey)}>
          <button
            type="button"
            aria-label={t(layout.titleTranslationKey)}
            aria-pressed={activeLayout === layout.key}
            className={`group grid h-[22px] w-7 place-items-center overflow-hidden rounded-sm bg-layer-transparent transition-all hover:bg-layer-transparent-hover ${activeLayout === layout.key ? "bg-layer-transparent-active" : ""}`}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("board", layout.key);
              setParams(next);
            }}
          >
            <IssueLayoutIcon
              layout={layout.key}
              className={`size-3.5 ${activeLayout === layout.key ? "text-primary" : "text-secondary"}`}
            />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
