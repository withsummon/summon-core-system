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
import { ArrowUpRight, Download, FileText } from "lucide-react";
import type { TSelectableIcon } from "@plane/propel/icons";
import type { ISummonProjectOverview } from "@plane/types";
import { filterProjectResources } from "@/components/summon/projects/project-workspace";

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
            title={`${issue.project.identifier}-${issue.sequence_id} · ${issue.name}`}
            detail={issue.state?.name || "State not set"}
            badge={issue.completed ? "Completed" : "Open"}
          />
        ))}
        {!overview.issues.length && <Empty text="No tasks yet." />}
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
            badge={`${item.completion}%`}
          />
        ))}
        {!overview.milestones.length && <Empty text="No modules or cycles yet." />}
      </TabPanel>
    );
  }
  if (tab === "documents") {
    return (
      <TabPanel title="Documents" manageHref={`/${workspaceSlug}/projects/${projectId}/pages/`}>
        {overview.pages.map((page) => (
          <Row key={page.id} href={page.href} title={page.name} detail="Document" />
        ))}
        {!overview.pages.length && <Empty text="No project documents yet." />}
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
        {!resources.length && <Empty text={`No ${tab} linked to this project.`} />}
      </TabPanel>
    );
  }
  if (tab === "activity") {
    return (
      <TabPanel title="Activity">
        {overview.activity.map((item) => (
          <Row key={item.id} href={item.href} title={item.label} detail={formatDate(item.created_at)} />
        ))}
        {!overview.activity.length && <Empty text="No recent project activity." />}
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
          className="flex items-center gap-3 border-b border-subtle py-3 last:border-0 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
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
      {!overview.files.length && <Empty text="No uploaded project files." />}
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

function Row({ href, title, detail, badge }: { href: string; title: string; detail: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-subtle py-3 last:border-0 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-medium break-words text-primary">{title}</strong>
        <small className="text-xs text-secondary">{detail}</small>
      </span>
      {badge && <span className="rounded-full bg-layer-1 px-2 py-1 text-xs text-secondary">{badge}</span>}
    </Link>
  );
}

function ExternalRow({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 border-b border-subtle py-3 last:border-0 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-medium break-words text-primary">{title}</strong>
        <small className="text-xs text-secondary">{detail}</small>
      </span>
      <ArrowUpRight className="size-4 text-secondary" />
    </a>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-10 text-center text-xs text-tertiary">{text}</p>;
}

const formatBytes = (size: number) => (size < 1024 ? `${size} B` : `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`);
