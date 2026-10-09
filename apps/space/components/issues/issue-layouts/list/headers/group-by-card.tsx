import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";

export function HeaderGroupByCard({
  icon,
  title,
  count,
  expanded,
  toggleListGroup,
}: {
  icon?: ReactNode;
  title: string;
  count: number | undefined;
  expanded: boolean;
  toggleListGroup: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={toggleListGroup}
      className="group/list-header relative flex w-full shrink-0 items-center gap-2 px-2 py-1.5 text-left hover:bg-layer-transparent-hover"
    >
      <span className="grid size-3.5 shrink-0 place-items-center overflow-hidden">
        {icon || <CircleDashed className="size-3.5" />}
      </span>
      <span className="relative flex w-full items-center gap-1 overflow-hidden">
        <span className="line-clamp-1 truncate font-medium text-primary">{title}</span>
        <span className="pl-2 text-13 font-medium text-tertiary">{count ?? "…"}</span>
      </span>
    </button>
  );
}
