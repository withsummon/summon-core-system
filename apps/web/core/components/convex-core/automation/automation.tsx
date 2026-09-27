import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { TemplateForm } from "./template-form";
import { RequestForm } from "./request-form";
import { JobBoundary, JobPreview } from "./job-preview";
type Mode =
  | { kind: "list" }
  | { kind: "edit"; template: Doc<"automationTemplates"> | null }
  | { kind: "generate"; template: Doc<"automationTemplates"> };
export function Automation({ workspace }: { workspace: FunctionReturnType<typeof api.workspaces.index.list>[number] }) {
  const templates = usePaginatedQuery(
    api.automation.templates.list,
    { workspaceId: workspace._id },
    { initialNumItems: 30 }
  );
  const jobs = usePaginatedQuery(api.automation.jobs.list, { workspaceId: workspace._id }, { initialNumItems: 20 });
  const install = useMutation(api.automation.templates.installDefaults);
  const [params, setParams] = useSearchParams();
  const selected = params.get("automationJob");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [tab, setTab] = useState<"templates" | "previews">("templates");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canWrite = workspace.membershipRole !== "guest";
  const select = (jobId: Id<"automationJobs"> | null) => {
    setMode({ kind: "list" });
    setTab("previews");
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (jobId) next.set("automationJob", jobId);
      else next.delete("automationJob");
      return next;
    });
  };
  if (selected)
    return (
      <JobBoundary key={selected} onBack={() => select(null)}>
        <JobPreview jobId={selected} workspaceId={workspace._id} onBack={() => select(null)} />
      </JobBoundary>
    );
  if (mode.kind === "edit" && canWrite)
    return (
      <TemplateForm
        key={mode.template?._id ?? "new"}
        workspaceId={workspace._id}
        template={mode.template}
        onDone={() => setMode({ kind: "list" })}
      />
    );
  if (mode.kind === "generate" && canWrite)
    return (
      <RequestForm
        key={mode.template._id}
        workspaceId={workspace._id}
        template={mode.template}
        onDone={select}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name}</p>
          <h1 className="text-28 font-semibold">Automation</h1>
        </div>
        {canWrite && <Button onClick={() => setMode({ kind: "edit", template: null })}>New template</Button>}
      </header>
      <nav aria-label="Automation sections" className="flex gap-2 border-b border-subtle-1 pb-3">
        <Button variant={tab === "templates" ? "primary" : "secondary"} onClick={() => setTab("templates")}>
          Templates
        </Button>
        <Button variant={tab === "previews" ? "primary" : "secondary"} onClick={() => setTab("previews")}>
          Your previews
        </Button>
      </nav>
      {tab === "templates" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-14 text-secondary">
              Choose a template, generate a private preview, then publish it to a project.
            </p>
            {canWrite && (
              <Button
                variant="secondary"
                loading={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  setNotice("");
                  try {
                    const result = await install({ workspaceId: workspace._id });
                    setNotice(
                      result.created ? `Added ${result.created} templates.` : "Default templates are already installed."
                    );
                  } catch (failure) {
                    setError(mutationMessage(failure));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Install default templates
              </Button>
            )}
          </div>
          <div className="divide-y divide-subtle-1 rounded-xl border border-subtle-1">
            {templates.results.map((template) => (
              <article key={template._id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-16 font-medium break-words">{template.name}</h2>
                  <p className="mt-1 text-12 text-secondary">
                    {template.type}
                    {!template.isActive && " · Inactive"}
                  </p>
                  {template.description && <p className="mt-2 text-14 text-secondary">{template.description}</p>}
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setMode({ kind: "edit", template })}>
                      Edit
                    </Button>
                    <Button disabled={!template.isActive} onClick={() => setMode({ kind: "generate", template })}>
                      Use template
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {templates.status === "LoadingFirstPage" && <p role="status">Loading templates…</p>}
          {templates.status === "Exhausted" && !templates.results.length && (
            <p className="py-8 text-center text-14 text-secondary">
              Create a template or install the default collection to get started.
            </p>
          )}
          {templates.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => templates.loadMore(30)}>
              Load more templates
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.results.map((job) => (
            <button
              key={job._id}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-subtle-1 p-4 text-left hover:bg-layer-1"
              onClick={() => select(job._id)}
            >
              <div className="min-w-0">
                <h2 className="text-16 font-medium break-words">{job.title}</h2>
                <p className="mt-1 text-12 text-secondary">{job.template.name}</p>
              </div>
              <span className="text-12 text-secondary">{job.publishedDocumentId ? "Published" : job.status}</span>
            </button>
          ))}
          {jobs.status === "LoadingFirstPage" && <p role="status">Loading previews…</p>}
          {jobs.status === "Exhausted" && !jobs.results.length && (
            <p className="py-8 text-center text-14 text-secondary">Your generated previews will appear here.</p>
          )}
          {jobs.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => jobs.loadMore(20)}>
              Load more previews
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="text-14 text-secondary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
