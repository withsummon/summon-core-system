import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { AuthenticatedAssetImage, AssetInitial } from "../assets/image";

export function WorkspaceLogoIdentity({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  return workspace.logo ? (
    <AuthenticatedAssetImage
      key={workspace.logo.id}
      asset={workspace.logo}
      alt="Workspace logo"
      className="h-6 w-6 rounded-md border border-subtle object-contain"
      compactName={workspace.name}
    />
  ) : (
    <AssetInitial name={workspace.name} />
  );
}
