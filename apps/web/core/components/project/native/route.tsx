import { useState, useContext, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { Outlet, useOutletContext, useLocation } from "react-router";
import { NativeProjectCreateContext, type WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PROJECT_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { TProjectDisplayFilters, TProjectFilters } from "@plane/types";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { NativeProjectDirectory } from "./directory";
import type { ProjectOperation } from "./operations";

export type ProjectDirectorySession = WorkspaceSession & {
  createProject: ReactNode;
  onCreateProject: (() => void) | null;
  directory: {
    search: string;
    setSearch: Dispatch<SetStateAction<string>>;
    filters: TProjectFilters;
    setFilters: Dispatch<SetStateAction<TProjectFilters>>;
    display: TProjectDisplayFilters;
    setDisplay: Dispatch<SetStateAction<TProjectDisplayFilters>>;
    selection: ProjectOperation | null;
    setSelection: Dispatch<SetStateAction<ProjectOperation | null>>;
  };
};
export function ProjectDirectoryRouteLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const onCreateProject = useContext(NativeProjectCreateContext);
  const { t } = useTranslation();
  const sticky = useStickiesCommands();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<TProjectFilters>({});
  const [display, setDisplay] = useState<TProjectDisplayFilters>({ order_by: "created_at" });
  const [selection, setSelection] = useState<ProjectOperation | null>(null);
  const createProject = onCreateProject && (
    <Button
      variant="primary"
      size="lg"
      onClick={onCreateProject}
      data-ph-element={PROJECT_TRACKER_ELEMENTS.CREATE_HEADER_BUTTON}
      className="items-center gap-1"
    >
      <span className="hidden sm:inline-block">{t("workspace_projects.create.label")}</span>
      <span className="inline-block sm:hidden">{t("workspace_projects.label", { count: 1 })}</span>
    </Button>
  );
  const context: ProjectDirectorySession = {
    ...session,
    createProject,
    onCreateProject,
    directory: { search, setSearch, filters, setFilters, display, setDisplay, selection, setSelection },
  };
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={sticky.create}
      onOpenStickies={sticky.openAll}
      beforeLeave={sticky.flushAll}
    >
      <Outlet context={context} />
    </PreservedWorkspaceShell>
  );
}

export function ProjectDirectoryPage() {
  const session = useOutletContext<ProjectDirectorySession>();
  const { pathname } = useLocation();
  return <NativeProjectDirectory session={session} archived={pathname.includes("/projects/archives")} />;
}
