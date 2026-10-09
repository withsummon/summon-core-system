import { useMemo, useState, type ComponentProps } from "react";
import { useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import { observer } from "mobx-react";
import { api } from "@summon/convex/api";
import { defaultTaskPreferences, taskPreferencesSchema, taskExpression } from "@summon/convex/task-schema";
import { DEFAULT_GLOBAL_VIEWS_LIST } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { EIssueLayoutTypes } from "@plane/types";
import { Button } from "@plane/propel/button";
import { SearchIcon, ViewsIcon } from "@plane/propel/icons";
import { Breadcrumbs, BreadcrumbNavigationSearchDropdown, Header, Input, Row } from "@plane/ui";
import { SavedViewEditor } from "@/app/(all)/[workspaceSlug]/(projects)/workspace-views/page";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { WorkspaceViewLayoutRoot } from "@/components/issues/issue-layouts/roots/project-view-layout-root";
import { TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { WorkspaceViewForm, WorkspaceReferenceFilters } from "@/components/convex-core/saved-views/workspace-form";
import { ViewDisplayFields } from "@/components/convex-core/saved-views/form";
import { useTaskFilterDraft } from "@/components/convex-core/saved-views/filters";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { DefaultWorkspaceViewQuickActions } from "@/components/workspace/views/default-view-quick-action";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";

export default observer(function NativeWorkspaceView() {
  const { pathname } = useLocation();
  const globalViewId = pathname.replace(/\/$/, "").split("/").at(-1);
  const view = DEFAULT_GLOBAL_VIEWS_LIST.find((item) => item.key === globalViewId);
  if (!view) throw new Response("Not Found", { status: 404 });
  const session = useOutletContext<WorkspaceSession>();
  const { storedValue, setValue } = useLocalStorage<unknown>(
    `native-workspace-view:${session.workspace._id}:${view.key}`,
    defaultTaskPreferences
  );
  const parsedPreferences = taskPreferencesSchema
    .pick({ displayFilters: true, displayProperties: true })
    .safeParse(storedValue);
  const preferences = parsedPreferences.success ? parsedPreferences.data : defaultTaskPreferences;
  const displayFilters = { ...preferences.displayFilters, layout: EIssueLayoutTypes.SPREADSHEET };
  const commands = useStickiesCommands();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editor, setEditor] = useState<
    NonNullable<ComponentProps<typeof WorkspaceViewForm>["createSeed"]> | "create" | null
  >(null);
  const [saveError, setSaveError] = useState("");
  const rawFilters = params.get("filters");
  const parsedFilters = useMemo(() => {
    try {
      return taskExpression.safeParse(rawFilters === null ? null : JSON.parse(rawFilters));
    } catch {
      return null;
    }
  }, [rawFilters]);
  const filters = parsedFilters?.success ? parsedFilters.data : null;
  const filterError =
    parsedFilters === null
      ? "The filters in this URL cannot be read. Clear filters to continue."
      : parsedFilters.success
        ? ""
        : "The filters in this URL are invalid. Clear filters to continue.";
  const filter = useTaskFilterDraft(filters, `${session.workspace._id}:${view.key}`);
  const draftFilters = taskExpression.safeParse(filter.expression);
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
    filterError
      ? "skip"
      : {
          workspaceId: session.workspace._id,
          scope,
          due: "all",
          today,
          search,
          order: displayFilters.order,
          includeSubtasks: displayFilters.includeSubtasks,
          filters,
        },
    { initialNumItems: 50 }
  );

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <PageHead title={`${session.workspace.name} - ${t(view.i18n_label)}`} />
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
              {session.workspace.membershipRole !== "guest" && (
                <Button variant="primary" size="lg" onClick={() => setEditor("create")}>
                  {t("workspace_views.add_view")}
                </Button>
              )}
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
            <div className="space-y-3 border-b border-subtle px-5 py-3">
              <ViewDisplayFields
                layouts={[EIssueLayoutTypes.SPREADSHEET]}
                displayFilters={displayFilters}
                displayProperties={preferences.displayProperties}
                disabled={false}
                onChange={setValue}
              />
            </div>
            {filterError ? (
              <div role="alert" className="space-y-2 p-5">
                <p>{filterError}</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.delete("filters");
                      next.delete("peek");
                      return next;
                    })
                  }
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="space-y-3 border-b border-subtle px-5 py-3">
                <WorkspaceReferenceFilters
                  key={filter.id}
                  workspaceId={session.workspace._id}
                  filter={filter}
                  selections={undefined}
                />
                {!draftFilters.success && (
                  <p role="alert">Complete or remove the unfinished filter before applying it.</p>
                )}
                <Button
                  variant="secondary"
                  disabled={!filter.hasChanges || !draftFilters.success}
                  onClick={() => {
                    if (!draftFilters.success) return;
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      if (draftFilters.data === null) next.delete("filters");
                      else next.set("filters", JSON.stringify(draftFilters.data));
                      next.delete("peek");
                      return next;
                    });
                    filter.resetExpression(draftFilters.data);
                    setSaveError("");
                  }}
                >
                  Apply filters
                </Button>
                {session.workspace.membershipRole !== "guest" && (
                  <Button
                    variant="secondary"
                    disabled={!draftFilters.success}
                    onClick={() => {
                      if (!draftFilters.success) return;
                      const scopeProperty =
                        scope === "mine" ? "assigneeId" : scope === "created" ? "createdBy" : "subscriberId";
                      const scopeFilter = {
                        id: `${view.key}:scope`,
                        type: "condition",
                        property: scopeProperty,
                        operator: "exact",
                        value: session.user.id,
                      };
                      const parsed = taskExpression.safeParse(
                        scope === "all"
                          ? draftFilters.data
                          : draftFilters.data === null
                            ? scopeFilter
                            : {
                                id: `${view.key}:filters`,
                                type: "group",
                                logicalOperator: "and",
                                children: [scopeFilter, draftFilters.data],
                              }
                      );
                      if (!parsed.success) {
                        setSaveError(
                          "These filters are too deeply nested to save with this view's scope. Remove a nested group and try again."
                        );
                        return;
                      }
                      setSaveError("");
                      setEditor({
                        input: {
                          name: t(view.i18n_label),
                          description: "",
                          filters: parsed.data,
                          displayFilters,
                          displayProperties: preferences.displayProperties,
                        },
                        logo: null,
                      });
                    }}
                  >
                    Save filters as view
                  </Button>
                )}
                {saveError && <p role="alert">{saveError}</p>}
              </div>
            )}
            <WorkspaceViewLayoutRoot
              rows={results}
              workspace={session.workspace}
              displayFilters={displayFilters}
              displayProperties={preferences.displayProperties}
              cohortComplete={status === "Exhausted"}
            />
            {status === "LoadingFirstPage" || (status === "LoadingMore" && results.length === 0) ? (
              <p role="status" className="p-5 text-13">
                Loading work items…
              </p>
            ) : null}
            {!filterError && status === "Exhausted" && results.length === 0 && (
              <p className="p-8 text-center text-13">No work items available.</p>
            )}
            {status === "CanLoadMore" && (
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
        <SavedViewEditor isOpen={editor !== null} onClose={() => setEditor(null)}>
          {(onPendingChange) =>
            editor !== null && (
              <WorkspaceViewForm
                workspaceId={session.workspace._id}
                initial={null}
                createSeed={editor === "create" ? undefined : editor}
                onPendingChange={onPendingChange}
                onDone={(id) => {
                  setEditor(null);
                  navigate(`/${session.workspace.slug}/workspace-views/${id}/`);
                }}
                onCancel={() => setEditor(null)}
              />
            )
          }
        </SavedViewEditor>
      </div>
    </PreservedWorkspaceShell>
  );
});
