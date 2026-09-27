import { Link } from "react-router";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
export function WorkspaceModuleDirectory({
  workspace,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
}) {
  const rows = usePaginatedQuery(api.modules.workspace.list, { workspaceId: workspace._id }, { initialNumItems: 30 });
  return (
    <section className="space-y-5">
      <header>
        <p className="text-12 text-secondary">{workspace.name}</p>
        <h1 className="text-28 font-semibold">Workspace modules</h1>
        <p className="mt-2 text-14 text-secondary">Modules from projects you can access.</p>
      </header>
      <ul className="divide-y divide-subtle-1">
        {rows.results.map(({ module, project }) => (
          <li key={module._id} className="py-4">
            <Link
              to={`/core?${new URLSearchParams({ workspace: workspace.slug, module: "projects", project: project.identifier, projectView: "modules", projectModule: module._id })}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md p-2 hover:bg-layer-2"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-12 text-secondary">
                  {project.identifier} · {project.name}
                </p>
                <h2 className="text-16 font-medium break-words">{module.name}</h2>
                <p className="text-12 text-secondary">
                  {module.startDate && module.targetDate
                    ? `${module.startDate} – ${module.targetDate}`
                    : module.startDate
                      ? `Starts ${module.startDate}`
                      : module.targetDate
                        ? `Target ${module.targetDate}`
                        : "Dates not set"}
                </p>
              </div>
              <span className="rounded-md bg-layer-2 px-2 py-1 text-12 capitalize">
                {module.status.replaceAll("-", " ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading workspace modules…</p>}
      {rows.status === "Exhausted" && !rows.results.length && (
        <div className="py-8">
          <h2 className="text-20 font-medium">No workspace modules</h2>
          <p className="mt-2 text-14 text-secondary">
            Create a module in a project to see it here. Archived and removed modules stay in their project recovery
            views.
          </p>
        </div>
      )}
      {rows.status === "CanLoadMore" && (
        <div className="space-y-2">
          <p className="text-12 text-secondary">Showing loaded modules. More may be available.</p>
          <Button variant="secondary" onClick={() => rows.loadMore(30)}>
            Load more modules
          </Button>
        </div>
      )}
      {rows.status === "LoadingMore" && <p role="status">Loading more modules…</p>}
    </section>
  );
}
