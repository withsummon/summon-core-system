import { useOutletContext } from "react-router";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { NativeStickiesPage } from "@/components/stickies/native/surfaces";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import type { WorkspaceSession } from "./native-workspace";

export default function NativeStickiesRoute() {
  const { user, workspace, workspaces } = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  return (
    <PreservedWorkspaceShell
      user={user}
      workspace={workspace}
      workspaces={workspaces}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <NativeStickiesPage />
    </PreservedWorkspaceShell>
  );
}
