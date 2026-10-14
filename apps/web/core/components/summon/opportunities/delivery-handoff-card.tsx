import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowUpRight, FolderKanban, FolderPlus, Link2, ListChecks, RotateCw } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonOpportunityDetail, TProject } from "@plane/types";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { TDeliveryHandoffState } from "./delivery-handoff";
import { deliveryHandoffState, linkableDeliveryProjects } from "./delivery-handoff";
import { Select } from "@plane/propel/select";

const readPendingProjectId = (pendingKey: string) =>
  typeof window === "undefined" ? null : window.sessionStorage.getItem(pendingKey);

function LinkedDelivery({
  workspaceSlug,
  state,
}: {
  workspaceSlug: string;
  state: Extract<TDeliveryHandoffState, { kind: "linked" }>;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="grid size-9 flex-none place-items-center rounded-lg bg-accent-subtle text-12 font-semibold text-accent-primary">
        {state.project.identifier.slice(0, 3)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-12 font-semibold text-primary" title={state.project.name}>
          {state.project.name}
        </p>
        <p className="mt-0.5 text-12 text-secondary">Delivery project · {state.project.identifier}</p>
      </div>
      <Link
        href={`/${workspaceSlug}/projects/${state.project.id}/issues/`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-subtle px-3 text-12 font-medium text-primary hover:bg-layer-1"
      >
        <ListChecks className="size-3.5" /> Tasks
      </Link>
      <Link
        href={`/${workspaceSlug}/summon/projects/${state.project.id}/`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent-primary px-3 text-12 font-medium text-white"
      >
        Open delivery project <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}

function NeedsClientDelivery(props: {
  workspaceSlug: string;
  busy: boolean;
  onSaveClient: (clientId: string) => void;
}) {
  const { workspaceSlug, busy, onSaveClient } = props;
  const [selectedClient, setSelectedClient] = useState("");
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );

  return (
    <div className="mt-2 grid gap-2">
      <p className="text-12 text-secondary">Choose the client this delivery is for before starting delivery.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Client"
          value={selectedClient}
          onValueChange={(value) => setSelectedClient(value)}
          className="min-w-48 flex-1"
          options={[
            { value: "", label: "Select a client" },
            ...clients.map((client) => ({ value: client.id, label: client.company_name || client.name })),
          ]}
        />
        <Button
          size="lg"
          disabled={!selectedClient || busy}
          loading={busy}
          onClick={() => onSaveClient(selectedClient)}
        >
          Save client
        </Button>
        <Link href={`/${workspaceSlug}/summon/clients/`} className="text-12 font-medium text-accent-primary">
          Add a client
        </Link>
      </div>
    </div>
  );
}

function ReadyDelivery(props: {
  opportunity: ISummonOpportunityDetail;
  linkable: Array<Pick<TProject, "id" | "identifier" | "name">>;
  busy: boolean;
  onCreate: () => void;
  onLink: (projectId: string) => void;
}) {
  const { opportunity, linkable, busy, onCreate, onLink } = props;
  const [mode, setMode] = useState<"choose" | "link">("choose");
  const [selectedProject, setSelectedProject] = useState("");

  return (
    <div className="mt-2 grid gap-3">
      <p className="text-12 text-secondary">
        Create a project for {opportunity.client_detail?.name || "this client"}, or link one you manage.
      </p>
      {mode === "choose" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={busy} onClick={onCreate}>
            <FolderPlus className="mr-1.5 size-3.5" /> Create project
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => setMode("link")}>
            <Link2 className="mr-1.5 size-3.5" /> Link existing project
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Project to link"
            value={selectedProject}
            onValueChange={(value) => setSelectedProject(value)}
            className="min-w-48 flex-1"
            options={[
              { value: "", label: linkable.length ? "Select a project" : "No projects you administer" },
              ...linkable.map((project) => ({
                value: project.id,
                label: `${project.identifier} · ${project.name}`,
              })),
            ]}
          />
          <Button size="lg" disabled={!selectedProject || busy} loading={busy} onClick={() => onLink(selectedProject)}>
            Link project
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => setMode("choose")}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function UnlinkedProjectAlert(props: {
  workspaceSlug: string;
  unlinkedProjectId: string;
  unlinkedProject: Pick<TProject, "identifier" | "name"> | undefined;
  busy: boolean;
  onRetry: () => void;
}) {
  const { workspaceSlug, unlinkedProjectId, unlinkedProject, busy, onRetry } = props;
  return (
    <div role="alert" className="mt-3 grid gap-2 rounded-xl bg-danger-subtle/20 p-3 text-12 text-danger-primary">
      <p>
        {unlinkedProject ? `${unlinkedProject.identifier} · ${unlinkedProject.name}` : "The project"} was created, but
        it isn’t linked to this opportunity yet.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={busy} disabled={busy} onClick={onRetry}>
          <RotateCw className="mr-1.5 size-3.5" /> Retry link
        </Button>
        <Link
          href={`/${workspaceSlug}/summon/projects/${unlinkedProjectId}/`}
          className="text-12 font-medium text-accent-primary"
        >
          Open project
        </Link>
      </div>
    </div>
  );
}

export const DeliveryHandoffCard = observer(function DeliveryHandoffCard(props: {
  workspaceSlug: string;
  opportunity: ISummonOpportunityDetail;
  onChanged: () => Promise<unknown>;
  className?: string;
}) {
  const { workspaceSlug, opportunity, onChanged } = props;
  const router = useRouter();
  const { joinedProjectIds, getProjectById } = useProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const state = deliveryHandoffState(opportunity);
  const pendingKey = `summon-delivery-pending:${workspaceSlug}:${opportunity.id}`;
  // A project that exists but whose link failed; kept so the user can retry without creating another.
  const [unlinkedProjectId, setUnlinkedProjectId] = useState<string | null>(null);
  // Re-read the stored pending project whenever the opportunity or its link state changes.
  const pendingSyncKey = `${pendingKey}:${state.kind}`;
  const [syncedPendingKey, setSyncedPendingKey] = useState<string | null>(null);
  if (syncedPendingKey !== pendingSyncKey) {
    setSyncedPendingKey(pendingSyncKey);
    setUnlinkedProjectId(state.kind === "linked" ? null : readPendingProjectId(pendingKey));
  }

  useEffect(() => {
    if (state.kind === "linked") window.sessionStorage.removeItem(pendingKey);
  }, [pendingKey, state.kind]);
  const linkable = linkableDeliveryProjects(joinedProjectIds.map((projectId) => getProjectById(projectId)));
  const unlinkedProject = unlinkedProjectId ? getProjectById(unlinkedProjectId) : undefined;

  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const attach = (projectId: string) =>
    run(async () => {
      await summonService.startDelivery(workspaceSlug, opportunity.id, projectId);
      window.sessionStorage.removeItem(pendingKey);
      setUnlinkedProjectId(null);
      router.push(`/${workspaceSlug}/summon/projects/${projectId}/`);
      await onChanged();
    });

  const onProjectCreated = (projectId: string) => {
    window.sessionStorage.setItem(pendingKey, projectId);
    setUnlinkedProjectId(projectId);
    void attach(projectId);
  };

  const saveClient = (selectedClient: string) =>
    run(async () => {
      await summonService.updateOpportunity(workspaceSlug, opportunity.id, { client: selectedClient });
      await onChanged();
    });

  return (
    <section
      aria-labelledby={`delivery-${opportunity.id}`}
      className={`rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs ${props.className ?? ""}`}
    >
      <div className="flex items-center gap-2">
        <FolderKanban className="size-4 text-accent-primary" />
        <h2 id={`delivery-${opportunity.id}`} className="text-12 font-semibold text-primary">
          Delivery
        </h2>
      </div>

      {state.kind === "linked" ? <LinkedDelivery workspaceSlug={workspaceSlug} state={state} /> : null}

      {state.kind === "not_won" ? (
        <p className="mt-2 text-12 text-secondary">Mark this opportunity as won to start delivery.</p>
      ) : null}

      {state.kind === "needs_client" ? (
        <NeedsClientDelivery
          workspaceSlug={workspaceSlug}
          busy={busy}
          onSaveClient={(clientId) => void saveClient(clientId)}
        />
      ) : null}

      {state.kind === "ready" && !unlinkedProjectId ? (
        <ReadyDelivery
          opportunity={opportunity}
          linkable={linkable}
          busy={busy}
          onCreate={() => setCreateOpen(true)}
          onLink={(projectId) => void attach(projectId)}
        />
      ) : null}

      {unlinkedProjectId && state.kind !== "linked" ? (
        <UnlinkedProjectAlert
          workspaceSlug={workspaceSlug}
          unlinkedProjectId={unlinkedProjectId}
          unlinkedProject={unlinkedProject}
          busy={busy}
          onRetry={() => void attach(unlinkedProjectId)}
        />
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-12 text-danger-primary">
          {error}
        </p>
      ) : null}

      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspaceSlug}
        data={{ cover_image_url: "" }}
        closeOnCreate
        onCreated={onProjectCreated}
      />
    </section>
  );
});
