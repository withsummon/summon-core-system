import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, ComponentProps } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Header, EHeaderVariant, Row } from "@plane/ui";
import { PriorityIcon } from "@plane/propel/icons";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { cn, renderFormattedDate } from "@plane/utils";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { taskStatusOptions } from "../tasks/options";
import { DescriptionHistory } from "../tasks/description-history";
import { TaskComments } from "../tasks/comments";
import { TaskReactions } from "../tasks/reactions/reactions";
import { TaskSubscription } from "../notifications/task-subscription";
import { TaskAttachments } from "../tasks/attachments/attachments";
import { IntakeDescription } from "./description";
import { IntakeTrash } from "./trash";
import { SubmissionForm } from "./forms";
import { DecisionForm, RemoveSubmission, intakeOptions, intakeDecisions } from "./decisions";
import { mutationMessage } from "../commercial/forms";
type Project = FunctionReturnType<typeof api.navigation.address.resolveProjectId>["project"];
type View = FunctionArgs<typeof api.intakes.index.list>["view"] | "trash";
const coreViews = [...intakeOptions, { value: "trash", label: "Trash" }] as const;

const selectionParams = (current: URLSearchParams, id: Id<"tasks"> | null, created = false) => {
  const next = new URLSearchParams(current);
  next.delete("comment");
  if (created) next.set("intakeStatus", "pending");
  if (id) next.set("intake", id);
  else next.delete("intake");
  return next;
};

// /core owns its existing URL selectors; the production route owns currentTab/inboxIssueId.
export function Intakes({ project, workspaceSlug }: { project: Project; workspaceSlug: string }) {
  const [params, setParams] = useSearchParams();
  const view = coreViews.find((option) => option.value === params.get("intakeStatus"))?.value ?? "pending";
  const changeView = (nextView: View) =>
    setParams((current) => {
      const next = selectionParams(current, null);
      next.set("intakeStatus", nextView);
      return next;
    });
  return (
    <IntakeView
      project={project}
      workspaceSlug={workspaceSlug}
      view={view}
      views={coreViews}
      selected={params.get("intake")}
      selectionHref={(id) => `?${selectionParams(params, id)}`}
      onSelect={(id, created) => setParams((current) => selectionParams(current, id, created))}
      onViewChange={changeView}
      onRestored={changeView}
    />
  );
}

export function IntakeView({
  project,
  workspaceSlug,
  view,
  views,
  selected,
  selectionHref,
  onSelect,
  onViewChange,
  onRestored,
}: {
  project: Project;
  workspaceSlug: string;
  view: View;
  views: readonly { value: View; label: string }[];
  selected: string | null;
  selectionHref: (id: Id<"tasks">) => string;
  onSelect: (id: Id<"tasks"> | null, created?: boolean) => void;
  onViewChange: (view: View) => void;
  onRestored: (status: FunctionReturnType<typeof api.intakes.lifecycle.get>["intake"]["status"]) => void;
}) {
  const config = useQuery(api.intakes.index.getConfig, { projectId: project._id });
  const submissions = usePaginatedQuery(
    api.intakes.index.list,
    view === "trash" ? "skip" : { projectId: project._id, view },
    { initialNumItems: 30 }
  );
  const displayed = selected ?? (view === "trash" ? null : (submissions.results[0]?.task._id ?? null));
  const changes = {
    remove: useMutation(api.intakes.index.remove),
    restore: useMutation(api.intakes.lifecycle.restore),
  };
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const continuation = useRef<(() => void) | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(pending, "The intake operation is still in progress.", leave);
  useEffect(() => leave, [leave]);
  // Removal and recovery invalidate their own detail queries; the command stays above those boundaries.
  const changeSubmission = async (
    operation: keyof typeof changes,
    snapshot:
      | FunctionReturnType<typeof api.intakes.index.resolve>
      | FunctionReturnType<typeof api.intakes.lifecycle.get>
  ) => {
    continuation.current = operation === "remove" ? () => onSelect(null) : () => onRestored(snapshot.intake.status);
    setPending(true);
    setError("");
    try {
      await changes[operation]({
        taskId: snapshot.task._id,
        expectedUpdatedAt: snapshot.intake.updatedAt,
        expectedTaskUpdatedAt: snapshot.task.updatedAt,
      });
    } catch (failure) {
      if (continuation.current !== null) setError(mutationMessage(failure));
      continuation.current = null;
      return;
    } finally {
      setPending(false);
    }
    release((allow) => {
      const navigate = continuation.current;
      continuation.current = null;
      if (allow) navigate?.();
    });
  };
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Intake submissions"
          className={cn(
            "h-full w-full shrink-0 flex-col border-r border-strong bg-surface-1 lg:flex lg:w-2/6",
            selected ? "hidden" : "flex"
          )}
        >
          <Header variant={EHeaderVariant.SECONDARY} className="shrink-0 gap-2">
            <nav aria-label="Intake views" className="flex h-full min-w-0 flex-1 overflow-x-auto">
              {views.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-current={view === option.value ? "page" : undefined}
                  disabled={view === option.value}
                  className="relative flex h-full shrink-0 items-center border-b-2 border-transparent px-3 text-13 font-medium hover:text-secondary aria-[current=page]:border-accent-strong aria-[current=page]:text-accent-primary"
                  onClick={() => onViewChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </nav>
            {config?.enabled && (
              <SubmissionForm
                key={`create:${project._id}:${view}:${selected}`}
                projectId={project._id}
                initial={null}
                disabled={pending}
                onDone={(id) => onSelect(id, true)}
              />
            )}
          </Header>
          <div className="vertical-scrollbar scrollbar-md min-h-0 flex-1 overflow-y-auto">
            {view === "trash" ? (
              <IntakeBoundary key={`trash:${project._id}`} onBack={() => onSelect(null)}>
                <IntakeTrash
                  project={project}
                  selected={null}
                  onSelect={onSelect}
                  pending={pending}
                  onRestore={(snapshot) => void changeSubmission("restore", snapshot)}
                />
              </IntakeBoundary>
            ) : (
              <>
                <ul>
                  {submissions.results.map(({ task, intake }) => (
                    <li key={task._id}>
                      <Link to={selectionHref(task._id)}>
                        <Row
                          className={cn(
                            "flex cursor-pointer flex-col gap-2 border border-t-transparent border-r-transparent border-b-subtle-1 border-l-transparent py-4 hover:bg-accent-primary/5",
                            displayed === task._id && "border-accent-strong"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-11 text-tertiary">
                              <span>
                                {project.identifier}-{task.sequence}
                              </span>
                              {intake.status !== "pending" &&
                                !(
                                  intake.status === "snoozed" &&
                                  intake.snoozedUntil !== null &&
                                  intake.snoozedUntil < Date.now()
                                ) && <span>{intakeDecisions[intake.status].label}</span>}
                            </div>
                            <h3 className="w-full truncate text-13">{task.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-11 text-secondary">
                            <span>{renderFormattedDate(new Date(task._creationTime).toISOString())}</span>
                            <PriorityIcon priority={task.priority} withContainer className="size-3" />
                          </div>
                        </Row>
                      </Link>
                    </li>
                  ))}
                </ul>
                {submissions.status === "LoadingFirstPage" && (
                  <p role="status" className="p-4">
                    Loading submissions…
                  </p>
                )}
                {submissions.status === "Exhausted" && !submissions.results.length && (
                  <EmptyStateCompact
                    assetKey="intake"
                    title="No submissions available in this view"
                    assetClassName="size-20"
                  />
                )}
                {submissions.status === "CanLoadMore" && (
                  <Button variant="secondary" className="m-4" onClick={() => submissions.loadMore(30)}>
                    Load more submissions
                  </Button>
                )}
              </>
            )}
          </div>
        </aside>
        <div className={cn("min-w-0 flex-1 overflow-y-auto p-4 lg:block lg:p-6", selected ? "block" : "hidden")}>
          {error && (
            <p role="alert" className="mb-4 text-14 text-danger-primary">
              {error}
            </p>
          )}
          {view === "trash" && displayed ? (
            <IntakeBoundary key={`removed:${displayed}`} onBack={() => onSelect(null)}>
              <IntakeTrash
                project={project}
                selected={displayed}
                onSelect={onSelect}
                pending={pending}
                onRestore={(snapshot) => void changeSubmission("restore", snapshot)}
              />
            </IntakeBoundary>
          ) : displayed ? (
            <IntakeBoundary key={displayed} onBack={() => onSelect(null)}>
              <IntakeDetail
                taskId={displayed}
                project={project}
                workspaceSlug={workspaceSlug}
                onBack={() => onSelect(null)}
                pending={pending}
                onRemove={(snapshot) => void changeSubmission("remove", snapshot)}
              />
            </IntakeBoundary>
          ) : (
            <EmptyStateCompact assetKey="intake" title="Select a submission to review" assetClassName="size-20" />
          )}
        </div>
      </div>
    </div>
  );
}
function IntakeDetail({
  taskId,
  project,
  workspaceSlug,
  onBack,
  pending,
  onRemove,
}: {
  taskId: string;
  project: Project;
  workspaceSlug: string;
  onBack: () => void;
  pending: boolean;
  onRemove: ComponentProps<typeof RemoveSubmission>["onConfirm"];
}) {
  const detail = useQuery(api.intakes.index.resolve, { taskId, projectId: project._id });
  const states = useQuery(api.tasks.states.list, { projectId: project._id });
  const [editor, setEditor] = useState<"submission" | "description" | "decision" | null>(null);
  if (!detail || !states) return <p role="status">Opening submission…</p>;
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" className="lg:hidden" onClick={onBack}>
          Show submissions
        </Button>
        <div className="flex flex-wrap gap-2">
          <TaskSubscription taskId={detail.task._id} />
          <DescriptionHistory scope={{ kind: "intake", taskId: detail.task._id }} />
          {detail.canEdit && (
            <Button variant="secondary" disabled={pending || editor !== null} onClick={() => setEditor("submission")}>
              Edit submission
            </Button>
          )}
          {detail.canDecide && editor !== "decision" && (
            <Button disabled={pending || editor !== null} onClick={() => setEditor("decision")}>
              Review submission
            </Button>
          )}
        </div>
      </header>
      {editor === "submission" && detail.canEdit ? (
        <SubmissionForm
          projectId={project._id}
          initial={detail}
          onDone={() => setEditor(null)}
          onCancel={() => setEditor(null)}
        />
      ) : (
        <div>
          <p className="mb-1 text-12 text-secondary">
            {project.identifier}-{detail.task.sequence} · {intakeDecisions[detail.intake.status].label}
          </p>
          <h2 className="text-24 font-semibold break-words">{detail.task.title}</h2>
          <p className="mt-2 text-14 text-secondary capitalize">
            {detail.task.priority} priority ·{" "}
            {states.find((state) => state._id === detail.task.stateId)?.name ??
              taskStatusOptions[detail.task.status].label}
          </p>
        </div>
      )}
      {editor === "decision" && detail.canDecide && <DecisionForm detail={detail} onClose={() => setEditor(null)} />}
      {detail.intake.status === "accepted" && (
        <Link
          className="inline-block text-14 text-accent-primary hover:underline"
          to={`/${workspaceSlug}/browse/${project.identifier}-${detail.task.sequence}`}
        >
          Open project task
        </Link>
      )}
      {detail.intake.snoozedUntil !== null && (
        <p className="text-14 text-secondary">Snoozed until {new Date(detail.intake.snoozedUntil).toLocaleString()}</p>
      )}
      {detail.intake.status === "duplicate" && (
        <div className="text-14">
          <span className="text-secondary">Duplicate of: </span>
          {detail.duplicateTarget ? (
            <Link
              className="text-accent-primary hover:underline"
              to={`/${workspaceSlug}/browse/${project.identifier}-${detail.duplicateTarget.sequence}`}
            >
              {project.identifier}-{detail.duplicateTarget.sequence} · {detail.duplicateTarget.title}
            </Link>
          ) : (
            <span className="text-secondary">Task unavailable</span>
          )}
        </div>
      )}
      <IntakeDescription
        key={`description:${detail.task._id}`}
        taskId={detail.task._id}
        editing={editor === "description"}
        onEdit={() => setEditor("description")}
        onDone={() => setEditor(null)}
        disabled={pending || editor !== null}
      />
      <TaskAttachments key={`attachments:${detail.task._id}`} taskId={detail.task._id} />
      <TaskReactions key={`reactions:${detail.task._id}`} taskId={detail.task._id} />
      <TaskComments key={`comments:${detail.task._id}`} taskId={detail.task._id} />
      {detail.canRemove && (
        <RemoveSubmission detail={detail} pending={pending} disabled={editor !== null} onConfirm={onRemove} />
      )}
    </article>
  );
}
function Unavailable({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-20 font-semibold">This submission is unavailable</h2>
      <p className="text-14 text-secondary">Check the project and your current intake access.</p>
      <Button variant="secondary" onClick={onBack}>
        Back to intake
      </Button>
    </section>
  );
}
class IntakeBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Unavailable onBack={this.props.onBack} /> : this.props.children;
  }
}
