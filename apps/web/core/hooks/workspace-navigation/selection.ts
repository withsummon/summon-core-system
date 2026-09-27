import type { IWorkspace } from "@plane/types";

/** Persist this selection before changing the route; rejection leaves the current workspace visible. */
export async function selectWorkspaceAndNavigate(
  workspace: Pick<IWorkspace, "id" | "slug">,
  select: (workspaceId: string) => Promise<void>,
  navigate: (href: string) => void
) {
  await select(workspace.id);
  navigate(`/${workspace.slug}`);
}
