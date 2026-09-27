import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
type Draft = FunctionArgs<typeof api.tasks.drafts.index.save>;
export function changeDraftProject(draft: Draft, projectId: Draft["projectId"]): Draft {
  return {
    ...draft,
    projectId,
    properties: { ...draft.properties, stateId: null, assigneeIds: [], labelIds: [] },
    parent: null,
    cycle: null,
    modules: [],
  };
}

export function hasScopedDraftSelections(draft: Draft) {
  return Boolean(
    draft.properties.stateId ||
    draft.properties.assigneeIds.length ||
    draft.properties.labelIds.length ||
    draft.parent ||
    draft.cycle ||
    draft.modules.length
  );
}
