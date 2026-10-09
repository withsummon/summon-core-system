import { useNavigate, useOutletContext, useParams } from "react-router";
import { ViewBoundary } from "@/components/convex-core/saved-views/saved-views";
import { WorkspaceViewDetail } from "@/components/convex-core/saved-views/workspace-views";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";

export default function NativeWorkspaceViewDetail() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const { globalViewId = "" } = useParams();
  const onBack = () => navigate(`/${session.workspace.slug}/workspace-views/`);
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <ViewBoundary key={globalViewId} onBack={onBack}>
        <WorkspaceViewDetail
          workspace={session.workspace}
          rawId={globalViewId}
          onBack={onBack}
          onLifecycle={() => onBack()}
          onCreated={(id) => navigate(`/${session.workspace.slug}/workspace-views/${id}/`)}
        />
      </ViewBoundary>
    </PreservedWorkspaceShell>
  );
}
