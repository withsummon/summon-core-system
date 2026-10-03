import { useEffect } from "react";
import { useOutletContext } from "react-router";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import Link from "next/link";
import { useConvex } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { ArrowUpRight, FileText } from "lucide-react";
import { FileAttachmentDownload } from "@/components/convex-core/tasks/attachments/download";
import { summarizeTaskProgress } from "@/components/convex-core/tasks/progress/summary";

export const PROJECT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "milestones", label: "Milestones" },
  { id: "documents", label: "Documents" },
  { id: "repositories", label: "Repositories" },
  { id: "deployments", label: "Deployments" },
  { id: "activity", label: "Activity" },
  { id: "files", label: "Files" },
] as const;
export type TProjectTab = (typeof PROJECT_TABS)[number]["id"];
export function ProjectDetailTab(props: {
  tab: Exclude<TProjectTab, "overview">;
  workspaceSlug: string;
  projectId: Id<"projects">;
}) {
  if (props.tab === "tasks") return <Tasks {...props} />;
  if (props.tab === "milestones") return <Milestones {...props} />;
  if (props.tab === "documents") return <Documents {...props} />;
  if (props.tab === "repositories" || props.tab === "deployments")
    return <Resources {...props} category={props.tab === "repositories" ? "repository" : "deployment"} />;
  if (props.tab === "activity") return <Activity {...props} />;
  return <Files {...props} />;
}
type Address = { workspaceSlug: string; projectId: Id<"projects"> };
function Tasks({ workspaceSlug, projectId }: Address) {
  const page = usePaginatedQuery(api.tasks.index.list, { projectId }, { initialNumItems: 50 });
  return (
    <TabPanel title="Tasks" manageHref={`/${workspaceSlug}/projects/${projectId}/issues/`}>
      {page.results.map((task) => (
        <Row
          key={task._id}
          href={`/${workspaceSlug}/projects/${projectId}/issues/${task._id}/`}
          title={task.title}
          detail={task.status}
          badge={task.completedAt === null ? "Open" : "Completed"}
        />
      ))}
      <PageState {...page} label="tasks" />
    </TabPanel>
  );
}
function Milestones({ workspaceSlug, projectId }: Address) {
  const modules = usePaginatedQuery(api.modules.index.list, { projectId, deleted: false }, { initialNumItems: 50 });
  const cycles = usePaginatedQuery(api.cycles.index.list, { projectId, deleted: false }, { initialNumItems: 50 });
  return (
    <TabPanel title="Milestones" manageHref={`/${workspaceSlug}/projects/${projectId}/modules/`}>
      {modules.results
        .filter((row) => !row.archived)
        .map((row) => (
          <Row
            key={row._id}
            href={`/${workspaceSlug}/projects/${projectId}/modules/${row._id}/`}
            title={row.name}
            detail={`Target ${row.targetDate || "Not set"}`}
            badge={<MilestoneCompletion moduleId={row._id} />}
          />
        ))}
      {cycles.results
        .filter((row) => !row.archived)
        .map((row) => (
          <Row
            key={row._id}
            href={`/${workspaceSlug}/projects/${projectId}/cycles/${row._id}/`}
            title={row.name}
            detail={`Target ${row.endDate || "Not set"}`}
            badge={<MilestoneCompletion cycleId={row._id} />}
          />
        ))}
      <PageState {...modules} label="modules" />
      <PageState {...cycles} label="cycles" />
    </TabPanel>
  );
}
export function MilestoneCompletion({ moduleId, cycleId }: { moduleId?: Id<"modules">; cycleId?: Id<"cycles"> }) {
  const modules = usePaginatedQuery(api.modules.progress.page, moduleId ? { moduleId } : "skip", {
    initialNumItems: 20,
  });
  const cycles = usePaginatedQuery(api.cycles.progress.page, cycleId ? { cycleId } : "skip", { initialNumItems: 20 });
  const page = moduleId ? modules : cycles;
  const { status: pageStatus, loadMore: loadPage } = page;
  useEffect(() => {
    if (pageStatus === "CanLoadMore") loadPage(20);
  }, [pageStatus, loadPage]);
  const totals = summarizeTaskProgress(page.results);
  return (
    <>
      {page.status === "Exhausted"
        ? `${totals.count ? Math.round((totals.completed.count * 100) / totals.count) : 0}%`
        : "…"}
    </>
  );
}
function Documents({ workspaceSlug, projectId }: Address) {
  const { workspace } = useOutletContext<WorkspaceSession>();
  const page = usePaginatedQuery(
    api.documents.index.list,
    { workspaceId: workspace._id, projectId },
    { initialNumItems: 50 }
  );
  return (
    <TabPanel title="Documents" manageHref={`/${workspaceSlug}/projects/${projectId}/pages/`}>
      {page.results.map(({ document }) => (
        <Row
          key={document._id}
          href={`/${workspaceSlug}/projects/${projectId}/pages/${document._id}/`}
          title={document.name || "Untitled Document"}
          detail="Plane page"
        />
      ))}
      <PageState {...page} label="documents" />
    </TabPanel>
  );
}
function Resources({ workspaceSlug, projectId, category }: Address & { category: string }) {
  const page = usePaginatedQuery(api.reporting.overview.resources, { projectId }, { initialNumItems: 50 });
  const { status: pageStatus, loadMore: loadPage } = page;
  useEffect(() => {
    if (pageStatus === "CanLoadMore") loadPage(50);
  }, [pageStatus, loadPage]);
  const resources = page.results.filter((row) => row.category === category);
  return (
    <TabPanel
      title={category === "repository" ? "Repositories" : "Deployments"}
      manageHref={`/${workspaceSlug}/summon/resources/`}
    >
      {resources.map((row) => (
        <a
          key={row._id}
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-0 hover:bg-layer-1"
        >
          <span className="min-w-0 flex-1">
            <strong className="text-xs block truncate font-medium text-primary">{row.title}</strong>
            <small className="text-[10px] text-secondary">{row.description || row.category}</small>
          </span>
          <ArrowUpRight className="size-4 text-secondary" />
        </a>
      ))}
      {page.status === "Exhausted" && !resources.length && (
        <Empty text={`No ${category === "repository" ? "repositories" : "deployments"} linked to this project.`} />
      )}
      {page.status !== "Exhausted" && (
        <p role="status" className="p-4">
          Loading resources…
        </p>
      )}
    </TabPanel>
  );
}
function Activity({ workspaceSlug, projectId }: Address) {
  const page = usePaginatedQuery(api.reporting.overview.activity, { projectId }, { initialNumItems: 50 });
  return (
    <TabPanel title="Activity">
      {page.results.map((row) => (
        <Row
          key={row._id}
          href={`/${workspaceSlug}/projects/${projectId}/issues/${row.taskId}/`}
          title={`${row.title} · ${row.kind.replaceAll("_", " ")}`}
          detail={new Date(row.at).toLocaleDateString()}
        />
      ))}
      <PageState {...page} label="activity" />
    </TabPanel>
  );
}
function Files({ projectId }: Address) {
  const page = usePaginatedQuery(api.reporting.overview.files, { projectId }, { initialNumItems: 50 });
  const client = useConvex();
  return (
    <TabPanel title="Files">
      {page.results.map((file) => (
        <div key={file.id} className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-0">
          <FileText className="size-4 shrink-0 text-accent-primary" />
          <span className="min-w-0 flex-1">
            <strong className="text-xs block truncate font-medium text-primary">{file.name}</strong>
            <small className="text-[10px] text-secondary">
              {file.contentType} · {file.size} B · {new Date(file.createdAt).toLocaleDateString()}
            </small>
          </span>
          <FileAttachmentDownload
            name={file.name}
            resolveFile={() => client.query(api.assets.index.get, { assetId: file.id })}
          />
        </div>
      ))}
      <PageState {...page} label="files" />
    </TabPanel>
  );
}
export function TabPanel({
  title,
  manageHref,
  children,
}: {
  title: string;
  manageHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-subtle bg-surface-1">
      <header className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
        {manageHref && (
          <Link href={manageHref} className="text-xs text-accent-primary">
            Manage all
          </Link>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}
export function Row({
  href,
  title,
  detail,
  badge,
}: {
  href: string;
  title: string;
  detail: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-0 hover:bg-layer-1"
    >
      <span className="min-w-0 flex-1">
        <strong className="text-xs block truncate font-medium text-primary">{title}</strong>
        <small className="text-[10px] text-secondary">{detail}</small>
      </span>
      {badge && <span className="rounded-full bg-layer-1 px-2 py-1 text-[10px] text-secondary">{badge}</span>}
    </Link>
  );
}
function PageState({
  status,
  results,
  loadMore,
  label,
}: Pick<ReturnType<typeof usePaginatedQuery>, "status" | "results" | "loadMore"> & { label: string }) {
  return (
    <>
      {status === "Exhausted" && !results.length && <Empty text={`No ${label} yet.`} />}
      {(status === "LoadingFirstPage" || status === "LoadingMore") && (
        <p role="status" className="p-4">
          Loading {label}…
        </p>
      )}
      {status === "CanLoadMore" && (
        <button
          type="button"
          className="text-xs m-4 rounded-xl border border-subtle px-4 py-2"
          onClick={() => loadMore(50)}
        >
          Load more {label}
        </button>
      )}
    </>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-xs p-10 text-center text-tertiary">{text}</p>;
}
