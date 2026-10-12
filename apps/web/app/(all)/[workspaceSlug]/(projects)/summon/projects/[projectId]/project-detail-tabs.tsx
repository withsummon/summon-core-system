import Link from "next/link";
import {
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  GitBranchIcon,
  RocketLaunchIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { ArrowUpRight, ChevronRight, Download, FileText } from "lucide-react";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { CompactAssetType } from "@plane/propel/empty-state";
import type { TSelectableIcon } from "@plane/propel/icons";
import type { ISummonProjectOverview } from "@plane/types";
import { filterProjectResources } from "@/components/summon/projects/project-workspace";
import { StatusBadge } from "@/components/summon/status-badge";

export type TProjectTab =
  | "overview"
  | "tasks"
  | "milestones"
  | "documents"
  | "repositories"
  | "deployments"
  | "activity"
  | "files";

export const PROJECT_TABS: Array<{ id: TProjectTab; label: string; icon: TSelectableIcon }> = [
  { id: "overview", label: "Overview", icon: SquaresFourIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquareIcon },
  { id: "milestones", label: "Milestones", icon: FlagIcon },
  { id: "documents", label: "Documents", icon: FileTextIcon },
  { id: "repositories", label: "Repositories", icon: GitBranchIcon },
  { id: "deployments", label: "Deployments", icon: RocketLaunchIcon },
  { id: "activity", label: "Activity", icon: ClockCounterClockwiseIcon },
  { id: "files", label: "Files", icon: FolderIcon },
];

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not set";

export function ProjectDetailTab(props: {
  tab: Exclude<TProjectTab, "overview">;
  overview: ISummonProjectOverview;
  workspaceSlug: string;
  projectId: string;
}) {
  const { tab, overview, workspaceSlug, projectId } = props;
  if (tab === "tasks") {
    return (
      <TabPanel title="Tasks" manageHref={`/${workspaceSlug}/projects/${projectId}/issues/`}>
        {overview.issues.map((issue) => (
          <Row
            key={issue.id}
            href={`/${workspaceSlug}/projects/${projectId}/issues/${issue.id}/`}
            title={issue.name}
            detail={`${issue.project.identifier}-${issue.sequence_id}`}
            badge={
              issue.state ? (
                <StatusBadge status={issue.state.group} label={issue.state.name} />
              ) : (
                <StatusBadge status="backlog" label="No state" />
              )
            }
          />
        ))}
        {!overview.issues.length && <Empty asset="work-item" text="No tasks yet." />}
      </TabPanel>
    );
  }
  if (tab === "milestones") {
    return (
      <TabPanel title="Milestones" manageHref={`/${workspaceSlug}/projects/${projectId}/modules/`}>
        {overview.milestones.map((item) => (
          <Row
            key={item.id}
            href={item.href}
            title={item.name}
            detail={`Target ${formatDate(item.target_date)}`}
            badge={<span className="text-12 text-secondary tabular-nums">{item.completion}%</span>}
          />
        ))}
        {!overview.milestones.length && <Empty asset="update" text="No modules or cycles yet." />}
      </TabPanel>
    );
  }
  if (tab === "documents") {
    return (
      <TabPanel title="Documents" manageHref={`/${workspaceSlug}/projects/${projectId}/pages/`}>
        {overview.pages.map((page) => (
          <Row key={page.id} href={page.href} title={page.name} detail="Document" />
        ))}
        {!overview.pages.length && <Empty asset="note" text="No project documents yet." />}
      </TabPanel>
    );
  }
  if (tab === "repositories" || tab === "deployments") {
    const category = tab === "repositories" ? "repository" : "deployment";
    const resources = filterProjectResources(overview.resources, category);
    return (
      <TabPanel
        title={tab === "repositories" ? "Repositories" : "Deployments"}
        manageHref={`/${workspaceSlug}/summon/resources/`}
      >
        {resources.map((resource) => (
          <ExternalRow
            key={resource.id}
            href={resource.url}
            title={resource.title}
            detail={resource.description || resource.category}
          />
        ))}
        {!resources.length && <Empty asset="link" text={`No ${tab} linked to this project.`} />}
      </TabPanel>
    );
  }
  if (tab === "activity") {
    return (
      <TabPanel title="Activity">
        {overview.activity.map((item) => (
          <Row key={item.id} href={item.href} title={item.label} detail={formatDate(item.created_at)} />
        ))}
        {!overview.activity.length && <Empty asset="update" text="No recent project activity." />}
      </TabPanel>
    );
  }
  return (
    <TabPanel title="Files">
      {overview.files.map((file) => (
        <a
          key={file.id}
          href={file.url}
          download
          className="-mx-2 flex items-center gap-3 rounded-md border-b border-subtle px-2 py-3 last:border-0 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <FileText className="size-4 shrink-0 text-accent-primary" />
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-medium break-words text-primary">{file.name}</strong>
            <small className="text-xs text-secondary">
              {file.content_type || file.entity_type} · {formatBytes(file.size)} · {formatDate(file.created_at)}
            </small>
          </span>
          <Download className="size-4 text-secondary" />
        </a>
      ))}
      {!overview.files.length && <Empty asset="export" text="No uploaded project files." />}
    </TabPanel>
  );
}

function TabPanel({ title, manageHref, children }: { title: string; manageHref?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <header className="flex items-center justify-between border-b border-subtle py-3">
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

function Row({ href, title, detail, badge }: { href: string; title: string; detail: string; badge?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-mx-2 flex items-center gap-3 rounded-md border-b border-subtle px-2 py-3 last:border-0 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-medium break-words text-primary">{title}</strong>
        <small className="text-xs text-secondary">{detail}</small>
      </span>
      {badge}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tertiary" />
    </Link>
  );
}

function ExternalRow({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="-mx-2 flex items-center gap-3 rounded-md border-b border-subtle px-2 py-3 last:border-0 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-medium break-words text-primary">{title}</strong>
        <small className="text-xs text-secondary">{detail}</small>
      </span>
      <ArrowUpRight className="size-4 text-secondary" />
    </a>
  );
}

function Empty({ text, asset }: { text: string; asset: CompactAssetType }) {
  return <EmptyStateCompact assetKey={asset} assetClassName="size-20" title={text} rootClassName="py-8" />;
}

const formatBytes = (size: number) => (size < 1024 ? `${size} B` : `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`);
