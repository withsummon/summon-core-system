import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { TaskDetail } from "./task-detail";
import { taskStatusOptions } from "./options";
type Filters = FunctionArgs<typeof api.tasks.center.list>;
const TaskDrafts = lazy(() => import("./drafts/drafts").then((module) => ({ default: module.TaskDrafts })));
export function TaskCenter({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const [params] = useSearchParams();
  return params.get("taskSection") === "drafts" ? (
    <Suspense fallback={<p role="status">Loading drafts…</p>}>
      <TaskDrafts key={workspace._id} workspace={workspace} />
    </Suspense>
  ) : (
    <TaskCenterContent workspace={workspace} />
  );
}
const scopes = [
  { value: "mine", label: "My tasks" },
  { value: "team", label: "Team tasks" },
  { value: "created", label: "Created by me" },
  { value: "all", label: "All tasks" },
] as const satisfies { value: Filters["scope"]; label: string }[];
const dueOptions = [
  { value: "all", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "This week" },
  { value: "next7", label: "Next 7 days" },
  { value: "completed", label: "Completed" },
] as const satisfies { value: Filters["due"]; label: string }[];
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies NonNullable<Filters["priority"]>[];
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function TaskCenterContent({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const [params, setParams] = useSearchParams();
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const scope = scopes.find((item) => item.value === params.get("scope"))?.value ?? "mine";
  const due = dueOptions.find((item) => item.value === params.get("due"))?.value ?? "all";
  const priority = priorities.find((item) => item === params.get("priority"));
  const search = params.get("search") ?? "";
  const filterProject = projects?.find((project) => project.identifier === params.get("taskProject"));
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const selected = params.get("task");
  const selectedProject = projects?.find((project) => project.identifier === params.get("project"));
  const invalidProjectFilter = Boolean(params.get("taskProject") && projects && !filterProject);
  const tasks = usePaginatedQuery(
    api.tasks.center.list,
    selected || invalidProjectFilter || projects === undefined
      ? "skip"
      : { workspaceId: workspace._id, scope, due, today, priority, projectId: filterProject?._id, search },
    { initialNumItems: 50 }
  );
  const setFilter = (name: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    });
  const back = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("comment");
      next.delete("task");
      next.delete("project");
      return next;
    });
  if (selected) {
    if (projects === undefined) return <p role="status">Opening task…</p>;
    return selectedProject ? (
      <TaskDetail key={selected} taskId={selected} project={selectedProject} onBack={back} />
    ) : (
      <section className="space-y-3">
        <h1 className="text-20 font-semibold">This project is unavailable</h1>
        <Button variant="secondary" onClick={back}>
          Back to tasks
        </Button>
      </section>
    );
  }
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name}</p>
          <h1 className="text-28 font-semibold">Tasks</h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => setParams({ workspace: workspace.slug, module: "tasks", taskSection: "drafts" })}
        >
          Drafts
        </Button>
        {filterProject && filterProject.membershipRole !== "guest" && filterProject.workspaceRole !== "guest" && (
          <Button
            onClick={() =>
              setParams({ workspace: workspace.slug, project: filterProject.identifier, projectView: "tasks" })
            }
          >
            Create task in project
          </Button>
        )}
      </header>
      <nav aria-label="Task ownership" className="flex flex-wrap gap-2 border-b border-subtle-1 pb-3">
        {scopes.map((item) => (
          <Button
            key={item.value}
            variant={scope === item.value ? "primary" : "secondary"}
            onClick={() => setFilter("scope", item.value)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <form
        key={`${search}:${due}:${priority}:${params.get("taskProject")}`}
        className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setParams((current) => {
            const next = new URLSearchParams(current);
            for (const key of ["search", "due", "priority", "taskProject"]) {
              const value = data.get(key);
              if (typeof value === "string" && value) next.set(key, value);
              else next.delete(key);
            }
            return next;
          });
        }}
      >
        <SummonField label="Search tasks">
          <Input
            name="search"
            type="search"
            maxLength={255}
            defaultValue={search}
            placeholder="Title, project, or identifier"
          />
        </SummonField>
        <SummonField label="Project" htmlFor="center-project">
          <select
            id="center-project"
            name="taskProject"
            defaultValue={params.get("taskProject") ?? ""}
            className="min-w-0 rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
          >
            <option value="">All projects</option>
            {invalidProjectFilter && <option value={params.get("taskProject") ?? ""}>Project unavailable</option>}
            {projects?.map((project) => (
              <option key={project._id} value={project.identifier}>
                {project.name}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="Due date" htmlFor="center-due">
          <select
            id="center-due"
            name="due"
            defaultValue={due}
            className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
          >
            {dueOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="Priority" htmlFor="center-priority">
          <select
            id="center-priority"
            name="priority"
            defaultValue={priority ?? ""}
            className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
          >
            <option value="">All priorities</option>
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </SummonField>
        <Button type="submit">Apply filters</Button>
      </form>
      {invalidProjectFilter ? (
        <p role="alert" className="text-14 text-secondary">
          This project filter is unavailable. Choose an accessible project or All projects.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-subtle-1">
            {tasks.results.map(({ task, project, state }) => (
              <li key={task._id}>
                <button
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4 text-left sm:grid-cols-[7rem_minmax(0,1fr)_8rem_7rem]"
                  onClick={() =>
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.delete("comment");
                      next.set("task", task._id);
                      next.delete("taskView");
                      next.set("project", project.identifier);
                      return next;
                    })
                  }
                >
                  <span className="text-12 text-secondary">
                    {project.identifier}-{task.sequence}
                  </span>
                  <span className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
                    <strong className="block text-14 font-medium break-words">{task.title}</strong>
                    <span className="text-12 text-secondary">
                      {project.name} · {task.priority} priority
                    </span>
                  </span>
                  <span className="text-right text-12 sm:text-left">
                    {state?.name ?? taskStatusOptions[task.status].label}
                  </span>
                  <span className="col-span-2 text-12 text-secondary sm:col-span-1">
                    {task.targetDate ?? "No due date"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {projects === undefined || tasks.status === "LoadingFirstPage" ? (
            <p role="status">Loading tasks…</p>
          ) : tasks.status === "Exhausted" && !tasks.results.length ? (
            <p className="py-8 text-center text-14 text-secondary">No tasks match these filters.</p>
          ) : null}
          {tasks.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
              Load more tasks
            </Button>
          )}
          {tasks.status === "LoadingMore" && <p role="status">Loading more tasks…</p>}
        </>
      )}
    </section>
  );
}
