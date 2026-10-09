import { useState } from "react";
import { Link, useOutletContext } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { useAction, useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Breadcrumbs, CustomSelect } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ArrowDownToLine } from "lucide-react";
import { PageHead } from "@/components/core/page-title";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { ImportExportSettingsLoader } from "@/components/ui/loader/settings/import-and-export";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

export default function ImportsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { t } = useTranslation();
  const projects = useQuery(api.projects.index.list, { workspaceId: session.workspace._id });
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);
  const [pending, setPending] = useState(false);
  const writable = projects?.filter((project) => project.membershipRole !== "guest") ?? [];
  return (
    <PreservedWorkspaceSettingsShell
      {...session}
      activePath={WORKSPACE_SETTINGS.import.i18n_label}
      hugging
      header={
        <SettingsPageHeader
          leftItem={
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label={t(WORKSPACE_SETTINGS.import.i18n_label)}
                    icon={<ArrowDownToLine className="size-4 text-tertiary" />}
                  />
                }
              />
            </Breadcrumbs>
          }
        />
      }
    >
      <PageHead title={`${session.workspace.name} - ${t("workspace_settings.settings.imports.title")}`} />
      <div className="flex w-full flex-col gap-6">
        <SettingsHeading
          title={t("workspace_settings.settings.imports.heading")}
          description="Import GitHub issues into an existing project."
        />
        <SettingsBoxedControlItem
          title="Destination project"
          control={
            <CustomSelect<Id<"projects"> | null>
              ariaLabel="Import destination project"
              value={projectId}
              onChange={setProjectId}
              disabled={pending || projects === undefined}
              label={writable.find((project) => project._id === projectId)?.name ?? "Choose a project"}
              input
              className="w-full md:w-64"
            >
              {writable.map((project) => (
                <CustomSelect.Option key={project._id} value={project._id}>
                  {project.identifier} · {project.name}
                </CustomSelect.Option>
              ))}
            </CustomSelect>
          }
        />
        {projects === undefined ? (
          <ImportExportSettingsLoader />
        ) : writable.length === 0 ? (
          <p className="text-13 text-secondary">Join a project as a member or administrator to import issues.</p>
        ) : projectId && writable.some((project) => project._id === projectId) ? (
          <GitHubImportForm
            key={projectId}
            workspaceId={session.workspace._id}
            workspaceSlug={session.workspace.slug}
            projectId={projectId}
            pending={pending}
            setPending={setPending}
          />
        ) : null}
        <ImportHistory workspaceId={session.workspace._id} workspaceSlug={session.workspace.slug} />
      </div>
    </PreservedWorkspaceSettingsShell>
  );
}

function GitHubImportForm({
  workspaceId,
  workspaceSlug,
  projectId,
  pending,
  setPending,
}: {
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  projectId: Id<"projects">;
  pending: boolean;
  setPending: (pending: boolean) => void;
}) {
  const preview = useAction(api.imports.index.preview);
  const start = useAction(api.imports.index.start);
  const credentials = usePaginatedQuery(api.mcp.credentials.list, { workspaceId }, { initialNumItems: 30 });
  const states = useQuery(api.tasks.states.list, { projectId });
  const usable = credentials.results.filter(
    (credential) =>
      credential.provider === "github" &&
      credential.canUse &&
      (credential.projectId === null || credential.projectId === projectId)
  );
  const selectableStates = states ?? [];
  const openStates = selectableStates.filter((state) => !["done", "cancelled"].includes(state.status));
  const closedStates = selectableStates.filter((state) => ["done", "cancelled"].includes(state.status));
  const [review, setReview] = useState<FunctionReturnType<typeof api.imports.index.preview> | null>(null);
  const [error, setError] = useState("");
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FunctionArgs<typeof api.imports.index.start>>({
    defaultValues: { projectId, requestId: crypto.randomUUID(), repositoryId: "", owner: "", repository: "" },
  });
  useReloadConfirmations(pending, "The import request is still being saved.", undefined, pending);
  const selectionChanged = () => {
    setReview(null);
    setValue("repositoryId", "");
    setValue("requestId", crypto.randomUUID());
  };
  const submit = handleSubmit(async (args) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (review) {
        await start(args);
        selectionChanged();
        setToast({ type: TOAST_TYPE.SUCCESS, title: "Import queued", message: "Track progress in import history." });
      } else {
        const { requestId: _request, repositoryId: _repository, ...selection } = args;
        const result = await preview(selection);
        setValue("repositoryId", result.id);
        setReview(result);
      }
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  });
  return (
    <form onSubmit={submit} onChangeCapture={selectionChanged} className="flex flex-col gap-4">
      <h3 className="text-h6-medium text-primary">GitHub</h3>
      <fieldset disabled={pending} className="rounded-lg border border-subtle bg-layer-2">
        <SettingsBoxedControlItem
          className="rounded-none border-0 border-b"
          title={<label htmlFor="github-import-owner">Repository owner</label>}
          control={
            <Input
              id="github-import-owner"
              {...register("owner", { required: true })}
              required
              className="w-full md:w-64"
            />
          }
        />
        <SettingsBoxedControlItem
          className="rounded-none border-0 border-b"
          title={<label htmlFor="github-import-repository">Repository name</label>}
          control={
            <Input
              id="github-import-repository"
              {...register("repository", { required: true })}
              required
              className="w-full md:w-64"
            />
          }
        />
        <SettingsBoxedControlItem
          className="rounded-none border-0 border-b"
          title="Vault credential"
          control={
            <Controller
              control={control}
              name="credentialId"
              rules={{ required: true }}
              render={({ field }) => (
                <CustomSelect<Id<"mcpCredentials">>
                  ariaLabel="GitHub import credential"
                  value={field.value}
                  disabled={pending}
                  input
                  className="w-full md:w-64"
                  label={
                    usable.find((credential) => credential._id === field.value)?.name ?? "Choose a GitHub credential"
                  }
                  onChange={(value) => {
                    field.onChange(value);
                    selectionChanged();
                  }}
                >
                  {usable.map((credential) => (
                    <CustomSelect.Option key={credential._id} value={credential._id}>
                      {credential.name}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
          }
        />
        <div className="flex flex-wrap items-center gap-3 border-b border-subtle px-4 py-3 text-13">
          <Link to={`/${workspaceSlug}/summon/credentials`} className="text-accent-primary underline">
            Manage GitHub credentials
          </Link>
          {credentials.status === "CanLoadMore" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => credentials.loadMore(30)}
            >
              Load more credentials
            </Button>
          )}
          {credentials.status === "Exhausted" && usable.length === 0 && (
            <span className="text-secondary">No usable GitHub credential for this project.</span>
          )}
        </div>
        <SettingsBoxedControlItem
          className="rounded-none border-0 border-b"
          title="Open issues"
          control={
            <Controller
              control={control}
              name="openStateId"
              rules={{ required: true }}
              render={({ field }) => (
                <CustomSelect<Id<"taskStates">>
                  ariaLabel="State for open GitHub issues"
                  value={field.value}
                  disabled={pending || states === undefined}
                  input
                  className="w-full md:w-64"
                  label={openStates.find((state) => state._id === field.value)?.name ?? "Choose an open state"}
                  onChange={(value) => {
                    field.onChange(value);
                    selectionChanged();
                  }}
                >
                  {openStates.map((state) => (
                    <CustomSelect.Option key={state._id} value={state._id}>
                      {state.name}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
          }
        />
        <SettingsBoxedControlItem
          className="rounded-none border-0"
          title="Closed issues"
          control={
            <Controller
              control={control}
              name="closedStateId"
              rules={{ required: true }}
              render={({ field }) => (
                <CustomSelect<Id<"taskStates">>
                  ariaLabel="State for closed GitHub issues"
                  value={field.value}
                  disabled={pending || states === undefined}
                  input
                  className="w-full md:w-64"
                  label={closedStates.find((state) => state._id === field.value)?.name ?? "Choose a completed state"}
                  onChange={(value) => {
                    field.onChange(value);
                    selectionChanged();
                  }}
                >
                  {closedStates.map((state) => (
                    <CustomSelect.Option key={state._id} value={state._id}>
                      {state.name}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
          }
        />
      </fieldset>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-13 text-danger-primary">
          Choose a credential and states, and enter the repository owner and name.
        </p>
      )}
      {review && (
        <div role="status" className="space-y-2 rounded-lg border border-subtle px-4 py-3 text-13">
          <p className="font-medium text-primary">
            {review.owner.login}/{review.name}
          </p>
          <p className="text-secondary">{review.scope}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
          {review ? "Start import" : "Preview repository"}
        </Button>
      </div>
    </form>
  );
}

function ImportHistory({ workspaceId, workspaceSlug }: { workspaceId: Id<"workspaces">; workspaceSlug: string }) {
  const imports = usePaginatedQuery(api.imports.index.history, { workspaceId }, { initialNumItems: 10 });
  const retry = useMutation(api.imports.index.retry);
  const [pending, setPending] = useState<Id<"workspaceImports"> | null>(null);
  const [error, setError] = useState("");
  useReloadConfirmations(pending !== null, "The import retry is still being saved.", undefined, pending !== null);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="import-history-heading">
      <h3 id="import-history-heading" className="border-b border-subtle pb-3 text-h6-medium text-primary">
        Import history
      </h3>
      {imports.status === "LoadingFirstPage" ? (
        <ImportExportSettingsLoader />
      ) : imports.results.length === 0 ? (
        <p className="py-6 text-13 text-secondary">No imports yet.</p>
      ) : (
        <ul className="divide-y divide-subtle rounded-lg border border-subtle">
          {imports.results.map((job) => (
            <li key={job._id} className="space-y-2 px-4 py-3 text-13">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 font-medium break-all text-primary">
                  {job.owner}/{job.repository}
                </span>
                <span className="text-secondary capitalize">{job.status}</span>
              </div>
              <Link
                to={`/${workspaceSlug}/projects/${job.projectId}/issues/`}
                className="text-accent-primary underline"
              >
                {job.projectIdentifier} · {job.projectName}
              </Link>
              <p className="text-secondary">
                {job.imported} imported · {job.duplicates} duplicates ({job.trashedDuplicates} in Trash) ·{" "}
                {job.pullRequests} pull requests skipped
              </p>
              {job.failure && <p className="text-danger-primary">{job.failure}</p>}
              {job.retryAt !== null && (
                <p className="text-secondary">Retry after {new Date(job.retryAt).toLocaleString()}.</p>
              )}
              {job.canRetry && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={pending === job._id}
                  disabled={pending !== null}
                  onClick={async () => {
                    setPending(job._id);
                    setError("");
                    try {
                      await retry({ jobId: job._id });
                    } catch (failure) {
                      setError(mutationMessage(failure));
                    } finally {
                      setPending(null);
                    }
                  }}
                >
                  Retry page
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      {imports.status === "CanLoadMore" && (
        <div>
          <Button type="button" variant="secondary" onClick={() => imports.loadMore(10)}>
            Load more imports
          </Button>
        </div>
      )}
    </section>
  );
}
