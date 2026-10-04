import { useNavigate, useOutletContext, useParams } from "react-router";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { SavedViewDetail, ViewBoundary } from "@/components/convex-core/saved-views/saved-views";

export default function ProjectViewIssuesPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId = "", viewId = "" } = useParams();
  const navigate = useNavigate();
  const back = () => navigate(`/${session.workspace.slug}/projects/${projectId}/views/`);
  return (
    <ViewBoundary key={`${projectId}:${viewId}`} onBack={back}>
      <SavedViewDetail
        workspaceId={session.workspace._id}
        projectId={projectId}
        rawId={viewId}
        onBack={back}
        onLifecycle={back}
        onCreated={(id) => navigate(`/${session.workspace.slug}/projects/${projectId}/views/${id}/`)}
      />
    </ViewBoundary>
  );
}
