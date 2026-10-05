import { useParams, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { priority } from "@summon/convex/task-schema";

export function useIssueFilter() {
  const { anchor } = useParams();
  const [params, setParams] = useSearchParams();
  const catalog = useQuery(api.publicSharing.index.catalog, anchor ? { anchor } : "skip");
  const settings = useQuery(api.publicSharing.index.settings, anchor ? { anchor } : "skip");
  const selectedStates = params.get("state")?.split(",") ?? [];
  const selectedLabels = params.get("labels")?.split(",") ?? [];
  const selectedPriorities = params.get("priority")?.split(",") ?? [];
  const stateIds =
    catalog?.states.filter((state) => selectedStates.includes(state._id)).map((state) => state._id) ?? [];
  const labelIds =
    catalog?.labels.filter((label) => selectedLabels.includes(label._id)).map((label) => label._id) ?? [];
  const priorities = priority.members.map((item) => item.value).filter((value) => selectedPriorities.includes(value));
  const invalid =
    catalog !== undefined &&
    [
      selectedStates.some((value) => !stateIds.some((id) => id === value)),
      selectedLabels.some((value) => !labelIds.some((id) => id === value)),
      selectedPriorities.some((value) => !priorities.some((item) => item === value)),
    ].includes(true);
  const filters: FunctionArgs<typeof api.publicSharing.index.list>["filters"] = {
    match: "all",
    statuses: [],
    stateIds,
    priorities,
    assigneeIds: [],
    labelIds,
    creatorIds: [],
    startDate: null,
    targetDate: null,
  };
  const requestedLayout = params.get("board");
  const layout =
    requestedLayout === "kanban" && settings?.settings.viewProps.kanban
      ? "kanban"
      : settings?.settings.viewProps.list
        ? "list"
        : "kanban";
  const change = (key: "state" | "priority" | "labels", value: string | null) => {
    const next = new URLSearchParams(params);
    const values = next.get(key)?.split(",") ?? [];
    const selected =
      value === null ? [] : values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    if (selected.length) next.set(key, selected.join(","));
    else next.delete(key);
    setParams(next);
  };
  const clear = () => {
    const next = new URLSearchParams(params);
    next.delete("state");
    next.delete("priority");
    next.delete("labels");
    setParams(next);
  };
  return { catalog, filters, invalid, layout, selectedStates, selectedLabels, selectedPriorities, change, clear };
}
