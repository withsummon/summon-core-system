import { useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import { DEFAULT_GLOBAL_VIEWS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { SearchIcon, ViewsIcon } from "@plane/propel/icons";
import {
  Breadcrumbs,
  BreadcrumbNavigationSearchDropdown,
  EModalPosition,
  EModalWidth,
  Header,
  Input,
  ModalCore,
  Row,
} from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { taskStatusOptions } from "@/components/convex-core/tasks/options";
import { TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { WorkspaceViewForm } from "@/components/convex-core/saved-views/workspace-form";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { DefaultWorkspaceViewQuickActions } from "@/components/workspace/views/default-view-quick-action";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";

export default function NativeWorkspaceView() {
  const { pathname } = useLocation();
  const globalViewId = pathname.replace(/\/$/, "").split("/").at(-1);
  const view = DEFAULT_GLOBAL_VIEWS_LIST.find((item) => item.key === globalViewId);
  if (!view) throw new Response("Not Found", { status: 404 });
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isMobile } = usePlatformOS();
  const [creatingView, setCreatingView] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const search = params.get("search") ?? "";
  const scope =
    view.key === "assigned"
      ? "mine"
      : view.key === "created"
        ? "created"
        : view.key === "subscribed"
          ? "subscribed"
          : "all";
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.center.list,
    { workspaceId: session.workspace._id, scope, due: "all", today, search },
    { initialNumItems: 50 }
  );

  const openTask = (identifier: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("peek", identifier);
      return next;
    });

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <PageHead title={`${session.workspace.name} - All Views`} />
      <div className="flex h-full min-h-0 flex-col">
        <Row className="z-[18] flex h-11 shrink-0 items-center gap-2 border-b border-subtle bg-surface-1">
          <Header>
            <Header.LeftItem>
              <Breadcrumbs>
                <Breadcrumbs.Item
                  component={
                    <BreadcrumbLink label={t("views")} icon={<ViewsIcon className="h-4 w-4 text-tertiary" />} />
                  }
                />
                <Breadcrumbs.Item
                  component={
                    <BreadcrumbNavigationSearchDropdown
                      selectedItem={view.key}
                      navigationItems={DEFAULT_GLOBAL_VIEWS_LIST.map((item) => ({
                        value: item.key,
                        query: t(item.i18n_label),
                        content: t(item.i18n_label),
                      }))}
                      onChange={(value) => navigate(`/${session.workspace.slug}/workspace-views/${value}/`)}
                      title={t(view.i18n_label)}
                      icon={<ViewsIcon className="size-4 shrink-0 text-tertiary" />}
                      isLast
                    />
                  }
                  isLast
                />
              </Breadcrumbs>
            </Header.LeftItem>
            <Header.RightItem className="items-center">
              <Button variant="primary" size="lg" onClick={() => setCreatingView(true)}>
                {t("workspace_views.add_view")}
              </Button>
              <DefaultWorkspaceViewQuickActions workspaceSlug={session.workspace.slug} view={view} />
            </Header.RightItem>
          </Header>
        </Row>
        <ContentWrapper>
          <div className="relative min-h-full w-full overflow-x-auto bg-layer-1 text-secondary">
            <div className="flex h-11 items-center gap-2 border-b border-subtle bg-surface-1 px-5">
              <SearchIcon className="size-3.5 shrink-0 text-secondary" />
              <Input
                aria-label="Search work items"
                type="search"
                maxLength={255}
                value={search}
                onChange={(event) =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    const value = event.target.value;
                    if (value) next.set("search", value);
                    else next.delete("search");
                    next.delete("peek");
                    return next;
                  })
                }
                placeholder="Search work items"
                mode="true-transparent"
                className="w-full bg-transparent !p-0 text-11 leading-5 text-secondary placeholder:text-placeholder focus:outline-none"
              />
            </div>
            <table className="w-full min-w-[760px] bg-surface-1 text-left">
              <thead className="sticky top-0 z-10 border-b border-subtle bg-layer-1 text-13 font-medium">
                <tr>
                  <th className="h-11 min-w-80 border-r border-subtle px-page-x font-medium">Work items</th>
                  <th className="h-11 min-w-36 border-r border-subtle px-4 font-medium">Project</th>
                  <th className="h-11 min-w-32 border-r border-subtle px-4 font-medium">State</th>
                  <th className="h-11 min-w-28 border-r border-subtle px-4 font-medium">Priority</th>
                  <th className="h-11 min-w-32 px-4 font-medium">Due date</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ task, project, state }) => {
                  const identifier = `${project.identifier}-${task.sequence}`;
                  const href = `/${session.workspace.slug}/browse/${identifier}/`;
                  return (
                    <tr key={task._id} className="h-11 border-b border-subtle bg-surface-1 hover:bg-surface-2">
                      <td className="min-w-80 border-r border-subtle px-page-x">
                        <Link
                          to={href}
                          className="flex min-w-0 items-center gap-3 text-13 text-primary"
                          onClick={(event) => {
                            if (
                              isMobile ||
                              event.button !== 0 ||
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.altKey
                            )
                              return;
                            event.preventDefault();
                            openTask(identifier);
                          }}
                        >
                          <span className="shrink-0 text-tertiary">{identifier}</span>
                          <span className="truncate">{task.title}</span>
                        </Link>
                      </td>
                      <td className="border-r border-subtle px-4 text-12">{project.name}</td>
                      <td className="border-r border-subtle px-4 text-12">
                        {state?.name ?? taskStatusOptions[task.status].label}
                      </td>
                      <td className="border-r border-subtle px-4 text-12 capitalize">{task.priority}</td>
                      <td className="px-4 text-12">{task.targetDate ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {status === "LoadingFirstPage" || (status === "LoadingMore" && results.length === 0) ? (
              <p role="status" className="p-5 text-13">
                Loading work items…
              </p>
            ) : null}
            {status === "Exhausted" && results.length === 0 && (
              <p className="p-8 text-center text-13">No work items available.</p>
            )}
            {status === "CanLoadMore" && results.length > 0 && (
              <Button variant="secondary" className="m-4" onClick={() => loadMore(50)}>
                Load more work items
              </Button>
            )}
            {status === "LoadingMore" && results.length > 0 && (
              <p role="status" className="p-4 text-13">
                Loading more work items…
              </p>
            )}
          </div>
        </ContentWrapper>
        <TaskPeek workspaceSlug={session.workspace.slug} />
        <ModalCore
          isOpen={creatingView}
          handleClose={() => setCreatingView(false)}
          position={EModalPosition.TOP}
          width={EModalWidth.XXL}
        >
          <div className="max-h-[80vh] overflow-y-auto p-5">
            {creatingView && (
              <WorkspaceViewForm
                workspaceId={session.workspace._id}
                initial={null}
                onDone={(id) => {
                  setCreatingView(false);
                  navigate(`/${session.workspace.slug}/workspace-views/${id}/`);
                }}
                onCancel={() => setCreatingView(false)}
              />
            )}
          </div>
        </ModalCore>
      </div>
    </PreservedWorkspaceShell>
  );
}
