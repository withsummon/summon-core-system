import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { ModuleIcon } from "@plane/propel/icons";
import { PanelRight } from "lucide-react";
import { Breadcrumbs, Header, Row } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageHead } from "@/components/core/page-title";
import { useLocalStorage } from "@plane/hooks";
import { ModuleActions } from "./actions";
import { ModuleSummary } from "./overview";
import { ModuleBoundary } from "./actions";
import { ModuleTasks } from "./tasks";
import { CreateProjectIssue, TaskPeek } from "../tasks/task-detail";
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;

export function ModuleDetailPage() {
  const address = useOutletContext<Address>();
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const root = `/${address.workspace.slug}/projects/${address.project._id}/modules/`;
  if (!moduleId) return <Link to={root}>View modules</Link>;
  return (
    <ModuleBoundary key={`${address.project._id}:${moduleId}`} onBack={() => navigate(root)}>
      <DetailContent address={address} moduleId={moduleId} />
    </ModuleBoundary>
  );
}

function DetailContent({ address, moduleId }: { address: Address; moduleId: string }) {
  const module = useQuery(api.modules.index.address, { projectId: address.project._id, moduleId });
  const states = useQuery(api.tasks.states.list, { projectId: address.project._id });
  const [creating, setCreating] = useState(false);
  const { storedValue, setValue } = useLocalStorage("module_sidebar_collapsed", "false");
  const collapsed = storedValue === "true";
  const root = `/${address.workspace.slug}/projects/${address.project._id}/modules/`;
  if (module === undefined)
    return (
      <p role="status" className="p-6">
        Loading module…
      </p>
    );
  if (module === null)
    return (
      <div className="space-y-3 p-6">
        <p role="alert">This module is unavailable in this project.</p>
        <Link to={root}>View modules</Link>
      </div>
    );
  const href = root + module._id + "/";
  return (
    <>
      <PageHead title={`${address.project.name} - ${module.name}`} />
      <Row className="z-[18] flex min-h-11 shrink-0 items-center border-b border-subtle bg-surface-1">
        <Header>
          <Header.LeftItem className="min-w-0 flex-1">
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label={address.project.name}
                    href={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                  />
                }
              />
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink label="Modules" href={root} icon={<ModuleIcon className="size-4 text-tertiary" />} />
                }
              />
              <Breadcrumbs.Item component={<BreadcrumbLink label={module.name} href={href} isLast />} isLast />
            </Breadcrumbs>
          </Header.LeftItem>
          <Header.RightItem className="shrink-0">
            {module.canEdit && (
              <Button size="lg" onClick={() => setCreating(true)}>
                Add work item
              </Button>
            )}
            <IconButton
              icon={PanelRight}
              variant="tertiary"
              size="lg"
              aria-label="Toggle module sidebar"
              aria-pressed={!collapsed}
              onClick={() => setValue(String(!collapsed))}
            />
            <ModuleActions module={module} href={href} />
          </Header.RightItem>
        </Header>
      </Row>
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          <ModuleTasks module={module} address={address} />
          {module.deleted && (
            <div className="space-y-3 p-6">
              <p>This module is in Trash.</p>
              <p className="text-14 text-secondary">Restore it to view its work items, members and links.</p>
              <ModuleActions module={module} href={href} />
            </div>
          )}
        </div>
        <aside
          aria-label="Module sidebar"
          hidden={collapsed}
          className="absolute inset-y-0 right-0 z-13 w-full max-w-96 overflow-auto border-l border-subtle bg-surface-1 p-6 shadow-raised-200 lg:static lg:shrink-0 lg:shadow-none"
        >
          <ModuleSummary module={module} />
        </aside>
      </div>
      <TaskPeek workspaceSlug={address.workspace.slug} />
      {creating && states && (
        <CreateProjectIssue
          address={address}
          states={states}
          canCreate={module.canEdit}
          onClose={() => setCreating(false)}
          initialValues={{ modules: [{ moduleId: module._id, expectedModuleUpdatedAt: module.updatedAt }] }}
        />
      )}
    </>
  );
}
