import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, ComponentProps } from "react";
import { ListFilter, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { subDays } from "date-fns";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Header, EHeaderVariant, Row, CustomMenu } from "@plane/ui";
import { PriorityIcon } from "@plane/propel/icons";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { cn, renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { FiltersDropdown, FilterOption } from "@/components/issues/issue-layouts/filters";
import { FilterChoices } from "../saved-views/filters";
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
type Selection = NonNullable<FunctionArgs<typeof api.intakes.index.list>["selection"]>;
const orders = {
  createdAt: { value: "createdAt", label: "Created date" },
  updatedAt: { value: "updatedAt", label: "Last updated date" },
  sequence: { value: "sequence", label: "ID" },
} as const satisfies { [Order in Selection["order"]]: { value: Order; label: string } };
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
      next.delete("intakeSelection");
      return next;
    });
  return (
    <IntakeBoundary
      key={JSON.stringify([project._id, view, params.get("intakeSelection")])}
      recoveryLabel="Clear filters"
      onBack={() =>
        setParams((current) => {
          const next = new URLSearchParams(current);
          next.delete("intakeSelection");
          return next;
        })
      }
    >
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
    </IntakeBoundary>
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
  const [params, setParams] = useSearchParams();
  const config = useQuery(api.intakes.index.getConfig, {
    projectId: project._id,
    view: view === "trash" ? undefined : view,
    selectionJson: params.get("intakeSelection") ?? undefined,
  });
  const submissions = usePaginatedQuery(
    api.intakes.index.list,
    view === "trash" || !config ? "skip" : { projectId: project._id, view, selection: config.selection },
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
  const release = useReloadConfirmations(pending, "The intake operation is still in progress.", leave, pending);
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
            {config && view !== "trash" && (
              <IntakeSelectionControls
                projectId={project._id}
                view={view}
                selection={config.selection}
                defaults={config.emptySelection}
                priorities={config.priorities}
                onChange={(next) => {
                  setParams((current) => {
                    const updated = new URLSearchParams(current);
                    updated.set("intakeSelection", JSON.stringify(next));
                    return updated;
                  });
                }}
              />
            )}
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
function IntakeSelectionControls({
  projectId,
  view,
  selection: appliedSelection,
  defaults,
  priorities,
  onChange: onApply,
}: {
  projectId: Id<"projects">;
  view: Exclude<View, "trash">;
  selection: Selection;
  defaults: Selection;
  priorities: FunctionReturnType<typeof api.intakes.index.getConfig>["priorities"];
  onChange: (selection: Selection) => void;
}) {
  const members = usePaginatedQuery(api.projects.directory.members, { projectId }, { initialNumItems: 50 });
  const labels = useQuery(api.tasks.labels.list, { projectId });
  const [search, setSearch] = useState("");
  const [selection, onChange] = useState(appliedSelection);
  const availableStatuses = intakeOptions.filter((option) =>
    view === "open"
      ? option.value === "pending" || option.value === "snoozed"
      : view === "closed"
        ? option.value !== "pending" && option.value !== "snoozed"
        : option.value === view
  );
  const applied =
    appliedSelection.statuses.length +
    appliedSelection.priorities.length +
    appliedSelection.creatorIds.length +
    appliedSelection.assigneeIds.length +
    appliedSelection.labelIds.length +
    Number(appliedSelection.createdAt !== null) +
    Number(appliedSelection.updatedAt !== null);
  return (
    <div className="flex shrink-0 items-center gap-2">
      <FiltersDropdown
        title={`Filters${applied ? ` (${applied})` : ""}`}
        icon={<ListFilter className="size-3" />}
        miniIcon={
          <>
            <ListFilter className="size-3" />
            <span className="sr-only">Filters</span>
          </>
        }
        placement="bottom-end"
        isFiltersApplied={applied > 0}
      >
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onApply({ ...selection, order: appliedSelection.order, direction: appliedSelection.direction });
          }}
        >
          <div className="shrink-0 p-2.5">
            <Input
              aria-label="Search intake filters"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="vertical-scrollbar scrollbar-sm space-y-3 divide-y divide-subtle-1 overflow-y-auto px-2.5 pb-2.5">
            <FilterChoices
              label="Work item status"
              options={availableStatuses
                .filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))
                .map((option) => ({ id: option.value, label: option.label }))}
              selected={selection.statuses}
              onChange={(statuses) => onChange({ ...selection, statuses })}
            />
            <FilterChoices
              label="Priority"
              options={priorities
                .filter((value) => value.includes(search.toLowerCase()))
                .map((value) => ({ id: value, label: value }))}
              selected={selection.priorities}
              onChange={(values) => onChange({ ...selection, priorities: values })}
            />
            {(["assigneeIds", "creatorIds"] as const).map((key) => (
              <div key={key} className="space-y-2 pt-3">
                <FilterChoices
                  label={key === "creatorIds" ? "Created by" : "Assignees"}
                  options={members.results
                    .filter((member) => member.name.toLowerCase().includes(search.toLowerCase()))
                    .map((member) => ({ id: member.userId, label: member.name }))}
                  selected={selection[key]}
                  onChange={(ids) => onChange({ ...selection, [key]: ids })}
                />
                {members.status === "CanLoadMore" && (
                  <Button variant="ghost" size="sm" onClick={() => members.loadMore(50)}>
                    Load more members
                  </Button>
                )}
              </div>
            ))}
            <FilterChoices
              label="Labels"
              options={(labels ?? [])
                .filter((label) => label.name.toLowerCase().includes(search.toLowerCase()))
                .map((label) => ({ id: label._id, label: label.name }))}
              selected={selection.labelIds}
              onChange={(labelIds) => onChange({ ...selection, labelIds })}
            />
            {(["createdAt", "updatedAt"] as const).map((key) => (
              <fieldset key={key} className="space-y-2 pt-3">
                <legend className="text-14 font-medium">
                  {key === "createdAt" ? "Created date" : "Last updated date"}
                </legend>
                {[
                  { name: "Today", days: 0, through: 0 },
                  { name: "Yesterday", days: 1, through: 1 },
                  { name: "Last 7 days", days: 7, through: 0 },
                  { name: "Last 30 days", days: 30, through: 0 },
                ]
                  .filter((option) => option.name.toLowerCase().includes(search.toLowerCase()))
                  .map((option) => {
                    const now = new Date();
                    const from = renderFormattedPayloadDate(subDays(now, option.days));
                    const to = renderFormattedPayloadDate(subDays(now, option.through));
                    const selected = selection[key]?.from === from && selection[key]?.to === to;
                    return (
                      <FilterOption
                        key={option.name}
                        title={option.name}
                        multiple={false}
                        isChecked={selected}
                        onClick={() => onChange({ ...selection, [key]: selected ? null : { from, to } })}
                      />
                    );
                  })}
                <div className="grid grid-cols-2 gap-2">
                  {(["from", "to"] as const).map((boundary) => (
                    <SummonField key={boundary} label={boundary === "from" ? "From" : "Through"}>
                      <Input
                        type="date"
                        min={boundary === "to" ? (selection[key]?.from ?? "0001-01-01") : "0001-01-01"}
                        max={boundary === "from" ? (selection[key]?.to ?? "9999-12-31") : "9999-12-31"}
                        aria-label={`${key === "createdAt" ? "Created date" : "Last updated date"} ${boundary}`}
                        value={selection[key]?.[boundary] ?? ""}
                        onChange={(event) => {
                          const range = {
                            from: selection[key]?.from ?? null,
                            to: selection[key]?.to ?? null,
                            [boundary]: event.target.value || null,
                          };
                          onChange({ ...selection, [key]: range.from || range.to ? range : null });
                        }}
                      />
                    </SummonField>
                  ))}
                </div>
              </fieldset>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...defaults, order: selection.order, direction: selection.direction })}
            >
              Clear filters
            </Button>
          </div>
          <div className="flex shrink-0 justify-end border-t border-subtle-1 p-2.5">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </div>
        </form>
      </FiltersDropdown>
      <CustomMenu
        customButton={
          <span className="flex items-center gap-1.5">
            {appliedSelection.direction === "asc" ? (
              <ArrowUpWideNarrow className="size-3" />
            ) : (
              <ArrowDownWideNarrow className="size-3" />
            )}
            <span className="sr-only xl:not-sr-only">
              Order by {orders[appliedSelection.order].label},{" "}
              {appliedSelection.direction === "asc" ? "ascending" : "descending"}
            </span>
          </span>
        }
        placement="bottom-end"
        closeOnSelect
      >
        {Object.values(orders).map((option) => (
          <CustomMenu.MenuItem key={option.value} onClick={() => onApply({ ...appliedSelection, order: option.value })}>
            {option.label}
          </CustomMenu.MenuItem>
        ))}
        <hr className="my-2 border-subtle" />
        {(["asc", "desc"] as const satisfies Selection["direction"][]).map((direction) => (
          <CustomMenu.MenuItem key={direction} onClick={() => onApply({ ...appliedSelection, direction })}>
            {direction === "asc" ? "Ascending" : "Descending"}
          </CustomMenu.MenuItem>
        ))}
      </CustomMenu>
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
function Unavailable({ onBack, recoveryLabel = "Back to intake" }: { onBack: () => void; recoveryLabel?: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-20 font-semibold">This submission is unavailable</h2>
      <p className="text-14 text-secondary">Check the selected filters, project and your current intake access.</p>
      <Button variant="secondary" onClick={onBack}>
        {recoveryLabel}
      </Button>
    </section>
  );
}
export class IntakeBoundary extends Component<
  { children: ReactNode; onBack: () => void; recoveryLabel?: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Unavailable onBack={this.props.onBack} recoveryLabel={this.props.recoveryLabel} />
    ) : (
      this.props.children
    );
  }
}
