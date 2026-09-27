import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import {
  FolderKanban,
  ListTodo,
  LayoutList,
  StickyNote,
  Users,
  Target,
  FileText,
  Link2,
  KeyRound,
  Bell,
  CalendarDays,
  MessageSquare,
  Workflow,
  ChartNoAxesCombined,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@plane/propel/button";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
import { Favorites } from "./favorites";
const modules = [
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "views", label: "Views", icon: LayoutList },
  { id: "stickies", label: "Stickies", icon: StickyNote },
  { id: "clients", label: "Clients", icon: Users },
  { id: "opportunities", label: "Opportunities", icon: Target },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "resources", label: "Resources", icon: Link2 },
  { id: "credentials", label: "Credentials", icon: KeyRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "meetings", label: "Meetings", icon: CalendarDays },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
  { id: "settings", label: "Settings", icon: Settings },
];
export function WorkspaceNavigation({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const [params] = useSearchParams();
  const active = params.get("module") ?? "projects";
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4 space-y-3 border-t border-subtle-1 pt-4">
      <div className="md:hidden">
        <Button
          variant="secondary"
          aria-expanded={open}
          aria-controls="native-workspace-navigation"
          onClick={() => setOpen(!open)}
        >
          <Menu className="mr-2 size-4" />
          Navigation · {modules.find((item) => item.id === active)?.label ?? "Projects"}
        </Button>
      </div>
      <div id="native-workspace-navigation" className={open ? "space-y-5" : "hidden space-y-5 md:block"}>
        <nav aria-label="Workspace modules" className="space-y-0.5">
          {modules.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/core?${new URLSearchParams({ workspace: workspace.slug, module: id })}`}
              aria-current={active === id ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <SidebarNavItem isActive={active === id}>
                <span className="flex min-w-0 items-center gap-2 py-1 text-13 font-medium">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </span>
              </SidebarNavItem>
            </Link>
          ))}
        </nav>
        <Favorites workspace={workspace} onNavigate={() => setOpen(false)} />
      </div>
    </section>
  );
}
