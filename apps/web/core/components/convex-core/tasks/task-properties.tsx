import { useEffect, useState } from "react";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { EstimateSelection } from "../estimates/selection";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { memberLabel } from "@summon/convex/member-label";
import { STATE_GROUPS } from "@plane/constants";
import { Avatar } from "@plane/propel/avatar";
import { Button } from "@plane/propel/button";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { Input } from "@plane/propel/input";
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  DueDatePropertyIcon,
  EstimatePropertyIcon,
  LabelFilledIcon,
  LabelPropertyIcon,
  LinkIcon,
  ViewsIcon,
  MembersPropertyIcon,
  PlusIcon,
  PriorityPropertyIcon,
  SearchIcon,
  StartDatePropertyIcon,
  StateGroupIcon,
  StatePropertyIcon,
  UserCirclePropertyIcon,
} from "@plane/propel/icons";
import { AvatarGroup } from "@plane/ui";
import {
  cn,
  getDate,
  renderFormattedDate,
  renderFormattedPayloadDate,
  shouldHighlightIssueDueDate,
} from "@plane/utils";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { DateDropdownView } from "@/components/dropdowns/date";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { SummonField } from "@/components/summon/forms";
import { AuthenticatedAssetImage } from "../assets/image";
import { mutationMessage, selectClass } from "../commercial/forms";
import { statusOptions, taskStatusOptions } from "./options";
export type TaskPropertyValues = Pick<
  Doc<"tasks">,
  "priority" | "assigneeIds" | "labelIds" | "startDate" | "targetDate" | "stateId" | "estimatePointId"
> &
  Pick<FunctionArgs<typeof api.tasks.drafts.index.save>, "status">;
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies TaskPropertyValues["priority"][];
export function TaskProperties<T extends TaskPropertyValues>({
  projectId,
  draft,
  onChange,
  allowDefaultState = false,
}: {
  projectId: Id<"projects"> | null;
  allowDefaultState?: boolean;
  draft: T;
  onChange: (draft: T) => void;
}) {
  const states = useQuery(api.tasks.states.list, projectId ? { projectId } : "skip");
  return (
    <TaskNonStateProperties projectId={projectId} draft={draft} onChange={onChange}>
      <SummonField label="State" htmlFor="task-state">
        <select
          id="task-state"
          className={selectClass}
          value={draft.stateId ?? draft.status ?? ""}
          onChange={(event) => {
            if (allowDefaultState && event.target.value === "") {
              onChange({ ...draft, stateId: null, status: null });
              return;
            }
            const state = states?.find((item) => item._id === event.target.value);
            if (state) onChange({ ...draft, stateId: state._id, status: state.status });
            else {
              const group = statusOptions.find((item) => item.value === event.target.value);
              if (group) onChange({ ...draft, stateId: null, status: group.value });
            }
          }}
        >
          {allowDefaultState && <option value="">Project default at publication</option>}
          <optgroup label="Status groups">
            {statusOptions.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
          {draft.stateId && !states?.some((state) => state._id === draft.stateId) && (
            <option value={draft.stateId}>Selected state unavailable or not loaded</option>
          )}
          <optgroup label="Project states">
            {states?.map((state) => (
              <option value={state._id} key={state._id}>
                {state.name}
              </option>
            ))}
          </optgroup>
        </select>
      </SummonField>
    </TaskNonStateProperties>
  );
}
export type NonStatePropertyValues = Omit<TaskPropertyValues, "status" | "stateId">;
export function TaskNonStateProperties<T extends NonStatePropertyValues>({
  projectId,
  draft,
  onChange,
  children,
}: {
  projectId: Id<"projects"> | null;
  draft: T;
  onChange: (draft: T) => void;
  children?: ReactNode;
}) {
  const labels = useQuery(api.tasks.labels.list, projectId ? { projectId } : "skip");
  const {
    results: members,
    status,
    loadMore,
  } = usePaginatedQuery(api.tasks.assignees.list, projectId ? { projectId } : "skip", { initialNumItems: 100 });
  return (
    <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      {children}
      <SummonField label="Priority" htmlFor="task-priority">
        <select
          id="task-priority"
          className={selectClass}
          value={draft.priority}
          onChange={(event) => {
            const priority = priorities.find((value) => value === event.target.value);
            if (priority) onChange({ ...draft, priority });
          }}
        >
          {priorities.map((priority) => (
            <option value={priority} key={priority}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </option>
          ))}
        </select>
      </SummonField>
      <EstimateSelection
        projectId={projectId}
        value={draft.estimatePointId}
        onChange={(estimatePointId) => onChange({ ...draft, estimatePointId })}
      />
      <SummonField label="Start date" htmlFor="task-start-date">
        <Input
          id="task-start-date"
          type="date"
          value={draft.startDate ?? ""}
          max={draft.targetDate ?? undefined}
          onChange={(event) => onChange({ ...draft, startDate: event.target.value || null })}
        />
      </SummonField>
      <SummonField label="Due date" htmlFor="task-due-date">
        <Input
          id="task-due-date"
          type="date"
          value={draft.targetDate ?? ""}
          min={draft.startDate ?? undefined}
          onChange={(event) => onChange({ ...draft, targetDate: event.target.value || null })}
        />
      </SummonField>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-14 font-medium">Assignees</legend>
        {members.map((member) => (
          <label key={member.id} className="flex min-w-0 gap-2 text-14 break-words">
            <input
              type="checkbox"
              checked={draft.assigneeIds.includes(member.id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  assigneeIds: event.target.checked
                    ? [...draft.assigneeIds, member.id]
                    : draft.assigneeIds.filter((id) => id !== member.id),
                })
              }
            />
            {memberLabel(member)}
          </label>
        ))}
        {status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => loadMore(100)}>
            Load more members
          </Button>
        )}
        {draft.assigneeIds
          .filter((id) => !members.some((member) => member.id === id))
          .map((id) => (
            <label key={id} className="flex min-w-0 gap-2 text-14 break-words">
              <input
                type="checkbox"
                checked
                onChange={() => onChange({ ...draft, assigneeIds: draft.assigneeIds.filter((value) => value !== id) })}
              />
              Member unavailable or not loaded ({id})
            </label>
          ))}
      </fieldset>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-14 font-medium">Labels</legend>
        {labels?.map((label) => (
          <label key={label._id} className="flex min-w-0 gap-2 text-14 break-words">
            <input
              type="checkbox"
              checked={draft.labelIds.includes(label._id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  labelIds: event.target.checked
                    ? [...draft.labelIds, label._id]
                    : draft.labelIds.filter((id) => id !== label._id),
                })
              }
            />
            <span style={{ color: label.color }} aria-hidden>
              ●
            </span>
            {label.name}
          </label>
        ))}
        {draft.labelIds
          .filter((id) => !labels?.some((label) => label._id === id))
          .map((id) => (
            <label key={id} className="flex min-w-0 gap-2 text-14 break-words">
              <input
                type="checkbox"
                checked
                onChange={() => onChange({ ...draft, labelIds: draft.labelIds.filter((value) => value !== id) })}
              />
              Label unavailable or not loaded ({id})
            </label>
          ))}
        {labels?.length === 0 && <p className="text-14 text-secondary">No project labels yet.</p>}
      </fieldset>
    </div>
  );
}

type InlinePropertyProps = {
  task: NonNullable<FunctionReturnType<typeof api.tasks.index.get>>;
  disabled: boolean;
  onChange: (
    change: Omit<FunctionArgs<typeof api.tasks.index.update>, "taskId" | "expectedUpdatedAt">
  ) => Promise<void>;
};

const stateGroups = {
  backlog: STATE_GROUPS.backlog.key,
  todo: STATE_GROUPS.unstarted.key,
  in_progress: STATE_GROUPS.started.key,
  done: STATE_GROUPS.completed.key,
  cancelled: STATE_GROUPS.cancelled.key,
} satisfies Record<NonNullable<FunctionReturnType<typeof api.tasks.index.get>>["status"], keyof typeof STATE_GROUPS>;
const propertyOptionClass =
  "flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-secondary outline-none data-[highlighted]:bg-layer-transparent-hover data-[disabled]:text-placeholder";

export function useTaskPropertyWriter(task: InlinePropertyProps["task"], lifecyclePending: boolean) {
  const update = useMutation(api.tasks.index.update);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const disabled = !task.canEdit || pending || lifecyclePending;
  useReloadConfirmations(pending, "Work item properties are still saving.", undefined, pending);
  const save: InlinePropertyProps["onChange"] = async (change) => {
    if (disabled) return;
    setPending(true);
    setError("");
    try {
      await update({ ...change, taskId: task._id, expectedUpdatedAt: task.updatedAt });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return { disabled, pending, error, save };
}

export function TaskInlineProperties({
  task,
  disabled: lifecyclePending,
}: {
  task: NonNullable<FunctionReturnType<typeof api.tasks.index.get>>;
  disabled: boolean;
}) {
  const profile = useQuery(api.identity.profile.get, {});
  const { disabled, pending, error, save } = useTaskPropertyWriter(task, lifecyclePending);
  const creatorName = task.creator.name || "Unavailable account";
  return (
    <fieldset disabled={!task.canEdit || lifecyclePending} aria-busy={pending || lifecyclePending} className="min-w-0">
      <legend className="text-body-xs-medium">Properties</legend>
      <div className={cn("mt-4 mb-2 space-y-2.5", !task.canEdit && "opacity-60")}>
        <SidebarPropertyListItem icon={StatePropertyIcon} label="State">
          <InlineTaskState task={task} disabled={disabled} onChange={save} />
        </SidebarPropertyListItem>
        <SidebarPropertyListItem icon={MembersPropertyIcon} label="Assignees">
          <InlineTaskAssignees task={task} disabled={disabled} onChange={save} />
        </SidebarPropertyListItem>
        <SidebarPropertyListItem icon={PriorityPropertyIcon} label="Priority">
          <PriorityDropdown
            value={task.priority}
            onChange={(priority) => void save({ priority })}
            disabled={disabled}
            buttonVariant="transparent-with-text"
            className="h-7.5 w-full grow rounded-sm"
            buttonContainerClassName="size-full text-left"
            buttonClassName="size-full px-2 py-0.5 whitespace-nowrap [&_svg]:size-3.5"
          />
        </SidebarPropertyListItem>
        <SidebarPropertyListItem icon={UserCirclePropertyIcon} label="Created by">
          <div className="flex min-w-0 grow items-center gap-2 px-2">
            {task.creator.avatar ? (
              <AuthenticatedAssetImage
                asset={task.creator.avatar}
                alt={creatorName}
                compactName={creatorName}
                className="size-5 rounded-full object-cover"
              />
            ) : (
              <Avatar name={creatorName} size="md" showTooltip={false} />
            )}
            <span className="grow truncate text-body-xs-regular leading-5">{creatorName}</span>
          </div>
        </SidebarPropertyListItem>
        {(
          [
            ["startDate", "Start date", StartDatePropertyIcon],
            ["targetDate", "Due date", DueDatePropertyIcon],
          ] as const
        ).map(([field, label, Icon]) => (
          <SidebarPropertyListItem key={field} icon={Icon} label={label}>
            <DateDropdownView
              value={task[field]}
              onChange={(date) => {
                const value = date ? renderFormattedPayloadDate(date) : null;
                void save(field === "startDate" ? { startDate: value } : { targetDate: value });
              }}
              minDate={field === "targetDate" ? (getDate(task.startDate) ?? undefined) : undefined}
              maxDate={field === "startDate" ? (getDate(task.targetDate) ?? undefined) : undefined}
              weekStartsOn={profile?.preferences.startOfWeek}
              placeholder={field === "startDate" ? "Add start date" : "Add due date"}
              disabled={disabled || !profile}
              buttonVariant="transparent-with-text"
              className="group w-full grow"
              buttonContainerClassName="h-7.5 w-full text-left"
              buttonClassName={cn("text-body-xs-regular", {
                "text-placeholder": !task[field],
                "text-danger-primary":
                  field === "targetDate" && shouldHighlightIssueDueDate(task.targetDate, stateGroups[task.status]),
              })}
              hideIcon
              clearIconClassName="hidden h-3 w-3 group-hover:inline"
            />
          </SidebarPropertyListItem>
        ))}
        <InlineTaskEstimate task={task} disabled={disabled} onChange={save} />
        <SidebarPropertyListItem icon={LabelPropertyIcon} label="Labels">
          <InlineTaskLabels task={task} disabled={disabled} onChange={save} />
        </SidebarPropertyListItem>
      </div>
      {pending && (
        <p role="status" className="text-body-xs-regular text-secondary">
          Saving properties…
        </p>
      )}
      {error && (
        <p role="alert" className="text-body-xs-regular text-danger-primary">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function TaskPropertyOptions({ label, children, footer }: { label: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner align="start" sideOffset={4} className="z-[120]">
        <Combobox.Popup
          aria-label={label}
          data-prevent-outside-click
          className="w-56 rounded-sm border border-strong bg-surface-1 px-2 py-2.5 text-11 shadow-raised-200"
        >
          <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
            <SearchIcon className="size-3.5 shrink-0 text-placeholder" />
            <Combobox.Input
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder={`Search ${label.toLowerCase()}`}
              className="min-w-0 grow bg-transparent py-1 text-11 text-secondary outline-none placeholder:text-placeholder"
            />
          </div>
          <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-auto">{children}</Combobox.List>
          {footer}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

export function InlineTaskState({ task, disabled, onChange }: InlinePropertyProps) {
  const states = useQuery(api.tasks.states.list, { projectId: task.projectId });
  const [search, setSearch] = useState("");
  const selected = states?.find((state) => state._id === task.stateId);
  const options = states?.filter((state) => state.name.toLowerCase().includes(search.trim().toLowerCase()));
  const groups =
    states?.length === 0
      ? statusOptions.filter((group) => group.label.toLowerCase().includes(search.trim().toLowerCase()))
      : [];
  return (
    <Combobox.Root<Id<"taskStates"> | typeof task.status, Id<"taskStates"> | typeof task.status | null>
      items={[...(options?.map((state) => state._id) ?? []), ...groups.map((group) => group.value)]}
      itemToStringLabel={(value) =>
        states?.find((state) => state._id === value)?.name ??
        statusOptions.find((group) => group.value === value)?.label ??
        ""
      }
      value={task.stateId ?? task.status}
      inputValue={search}
      onInputValueChange={setSearch}
      filter={null}
      disabled={disabled || !states}
      onValueChange={(value) => {
        const state = states?.find((item) => item._id === value);
        if (state) void onChange({ stateId: state._id, status: state.status });
        else {
          const group = statusOptions.find((item) => item.value === value);
          if (group) void onChange({ stateId: null, status: group.value });
        }
      }}
    >
      <Combobox.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="State"
            className="group font-normal h-7.5 w-full justify-start text-body-xs-regular"
          >
            <StateGroupIcon
              stateGroup={stateGroups[task.status]}
              className="size-3.5 shrink-0"
              color={selected?.color}
            />
            <span className="min-w-0 grow truncate text-left">
              {states ? (selected?.name ?? taskStatusOptions[task.status].label) : "Loading state…"}
            </span>
            <ChevronDownIcon className="hidden size-3.5 group-hover:inline" />
          </Button>
        }
      />
      <TaskPropertyOptions label="State">
        {options?.map((state) => (
          <Combobox.Item key={state._id} value={state._id} disabled={disabled} className={propertyOptionClass}>
            <StateGroupIcon stateGroup={stateGroups[state.status]} className="size-3.5 shrink-0" color={state.color} />
            <span className="min-w-0 grow truncate">{state.name}</span>
            <Combobox.ItemIndicator>
              <CheckIcon className="size-3.5" />
            </Combobox.ItemIndicator>
          </Combobox.Item>
        ))}
        {groups.map((group) => (
          <Combobox.Item key={group.value} value={group.value} disabled={disabled} className={propertyOptionClass}>
            <StateGroupIcon stateGroup={stateGroups[group.value]} className="size-3.5 shrink-0" />
            <span className="grow">{group.label}</span>
            <Combobox.ItemIndicator>
              <CheckIcon className="size-3.5" />
            </Combobox.ItemIndicator>
          </Combobox.Item>
        ))}
        <Combobox.Empty className="px-1 py-1.5 text-placeholder">No matching states.</Combobox.Empty>
      </TaskPropertyOptions>
    </Combobox.Root>
  );
}

export function TaskMemberAvatar({ member }: { member: InlinePropertyProps["task"]["assignees"][number] }) {
  const name = memberLabel(member);
  return member.avatar ? (
    <AuthenticatedAssetImage
      asset={member.avatar}
      alt={name}
      compactName={name}
      className="size-5 rounded-full object-cover"
    />
  ) : (
    <Avatar name={name} size="md" showTooltip={false} />
  );
}

export function InlineTaskAssignees({ task, disabled, onChange }: InlinePropertyProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.assignees.list,
    open ? { projectId: task.projectId, search } : "skip",
    { initialNumItems: 100 }
  );
  const selected = task.assignees.filter(
    (member) =>
      !results.some((option) => option.id === member.id) &&
      memberLabel(member).toLowerCase().includes(search.trim().toLowerCase())
  );
  const options = [...selected, ...results];
  return (
    <Combobox.Root<Id<"users">, Id<"users">, true>
      items={options.map((member) => member.id)}
      multiple
      value={task.assigneeIds}
      inputValue={search}
      onInputValueChange={setSearch}
      open={open}
      onOpenChange={setOpen}
      filter={null}
      disabled={disabled}
      onValueChange={(assigneeIds) => void onChange({ assigneeIds })}
    >
      <Combobox.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="group font-normal h-7.5 w-full justify-start text-body-xs-regular"
            aria-label={
              task.assignees.length ? `Assignees: ${task.assignees.map(memberLabel).join(", ")}` : "Add assignees"
            }
          >
            {task.assignees.length > 0 && (
              <AvatarGroup showTooltip={false}>
                {task.assignees.map((member) => (
                  <TaskMemberAvatar key={member.id} member={member} />
                ))}
              </AvatarGroup>
            )}
            {task.assignees.length < 2 && (
              <span
                className={cn("min-w-0 grow truncate text-left", task.assignees.length === 0 && "text-placeholder")}
              >
                {task.assignees.length ? memberLabel(task.assignees[0]) : "Add assignees"}
              </span>
            )}
            <ChevronDownIcon className="ml-auto hidden size-3.5 group-hover:inline" />
          </Button>
        }
      />
      <TaskPropertyOptions
        label="Assignees"
        footer={
          status === "CanLoadMore" ? (
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => loadMore(100)}>
              Load more members
            </Button>
          ) : (
            (status === "LoadingFirstPage" || status === "LoadingMore") && (
              <p role="status" className="px-1 py-1.5 text-placeholder">
                Loading members…
              </p>
            )
          )
        }
      >
        {options.map((member) => (
          <Combobox.Item key={member.id} value={member.id} disabled={disabled} className={propertyOptionClass}>
            <TaskMemberAvatar member={member} />
            <span className="min-w-0 grow truncate">
              {memberLabel(member)}
              {!member.selectable && <span className="ml-1 text-placeholder">(no longer assignable)</span>}
            </span>
            <Combobox.ItemIndicator>
              <CheckIcon className="size-3.5" />
            </Combobox.ItemIndicator>
          </Combobox.Item>
        ))}
        {status === "Exhausted" && options.length === 0 && (
          <p role="status" className="px-1 py-1.5 text-placeholder">
            No matching members.
          </p>
        )}
      </TaskPropertyOptions>
    </Combobox.Root>
  );
}

export function InlineTaskLabels({ task, disabled, onChange }: InlinePropertyProps) {
  const labels = useQuery(api.tasks.labels.list, { projectId: task.projectId });
  const [search, setSearch] = useState("");
  const options = labels?.filter((label) => label.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <>
      {labels
        ?.filter((label) => task.labelIds.includes(label._id))
        .map((label) => (
          <Button
            key={label._id}
            variant="tertiary"
            size="sm"
            aria-label={`Remove label ${label.name}`}
            disabled={disabled}
            onClick={() => void onChange({ labelIds: task.labelIds.filter((id) => id !== label._id) })}
          >
            <LabelFilledIcon className="size-3" color={label.color} />
            <span className="text-body-xs-regular">{label.name}</span>
            {!disabled && <CloseIcon className="size-2.5" />}
          </Button>
        ))}
      <Combobox.Root<Id<"taskLabels">, Id<"taskLabels">, true>
        items={options?.map((label) => label._id) ?? []}
        multiple
        value={task.labelIds}
        inputValue={search}
        onInputValueChange={setSearch}
        filter={null}
        disabled={disabled || !labels}
        onValueChange={(labelIds) => void onChange({ labelIds })}
      >
        <Combobox.Trigger
          render={
            <Button variant="ghost" size="sm" aria-label="Add labels" prependIcon={<PlusIcon />}>
              Add labels
            </Button>
          }
        />
        <TaskPropertyOptions label="Labels">
          {options?.map((label) => (
            <Combobox.Item
              key={label._id}
              value={label._id}
              disabled={disabled || (label.retiring && !task.labelIds.includes(label._id))}
              className={propertyOptionClass}
            >
              <LabelFilledIcon className="size-3.5 shrink-0" color={label.color} />
              <span className="min-w-0 grow truncate">
                {label.name}
                {label.retiring && " (being removed)"}
              </span>
              <Combobox.ItemIndicator>
                <CheckIcon className="size-3.5" />
              </Combobox.ItemIndicator>
            </Combobox.Item>
          ))}
          <Combobox.Empty className="px-1 py-1.5 text-placeholder">No matching labels.</Combobox.Empty>
        </TaskPropertyOptions>
      </Combobox.Root>
    </>
  );
}

export function InlineTaskEstimate({
  task,
  disabled,
  onChange,
  inline = false,
}: InlinePropertyProps & { inline?: boolean }) {
  const choices = useQuery(api.estimates.selection.choices, { projectId: task.projectId });
  const selected = useQuery(api.estimates.selection.forTask, {
    taskId: task._id,
    recovery: task.deletedAt !== null,
  });
  const [search, setSearch] = useState("");
  if (!choices || selected === undefined || (!choices.system && !selected)) return null;
  const options = choices.points.filter((point) => point.value.toLowerCase().includes(search.trim().toLowerCase()));
  const content = (
    <Combobox.Root<Id<"estimatePoints"> | null>
      items={[null, ...options.map((point) => point._id)]}
      itemToStringLabel={(value) =>
        value === null
          ? "No estimate"
          : (choices.points.concat(selected ? [selected.point] : []).find((point) => point._id === value)?.value ?? "")
      }
      value={task.estimatePointId}
      inputValue={search}
      onInputValueChange={setSearch}
      filter={null}
      disabled={disabled || !choices.canAssign}
      onValueChange={(estimatePointId) => void onChange({ estimatePointId })}
    >
      <Combobox.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Estimate"
            className="group font-normal h-7.5 w-full justify-start text-body-xs-regular"
          >
            <span className={cn("min-w-0 grow truncate text-left", !selected && "text-placeholder")}>
              {selected?.point.value ?? "No estimate"}
              {selected && !choices.points.some((point) => point._id === selected.point._id) && " (not active)"}
            </span>
            <ChevronDownIcon className="hidden size-3.5 group-hover:inline" />
          </Button>
        }
      />
      <TaskPropertyOptions label="Estimate">
        <Combobox.Item value={null} disabled={disabled} className={propertyOptionClass}>
          <span className="grow">No estimate</span>
          <Combobox.ItemIndicator>
            <CheckIcon className="size-3.5" />
          </Combobox.ItemIndicator>
        </Combobox.Item>
        {options.map((point) => (
          <Combobox.Item key={point._id} value={point._id} disabled={disabled} className={propertyOptionClass}>
            <span className="min-w-0 grow truncate">{point.value}</span>
            <Combobox.ItemIndicator>
              <CheckIcon className="size-3.5" />
            </Combobox.ItemIndicator>
          </Combobox.Item>
        ))}
      </TaskPropertyOptions>
    </Combobox.Root>
  );
  return inline ? (
    content
  ) : (
    <SidebarPropertyListItem icon={EstimatePropertyIcon} label="Estimate">
      {content}
    </SidebarPropertyListItem>
  );
}

/** List and board property controls share the detail writer and its revision. */
export function TaskRowProperties({
  task,
  display,
  disabled: lifecyclePending,
}: {
  task: InlinePropertyProps["task"];
  display: FunctionReturnType<typeof api.tasks.profile.preferences>["displayProperties"];
  disabled: boolean;
}) {
  const profile = useQuery(api.identity.profile.get, {});
  const { disabled, pending, error, save } = useTaskPropertyWriter(task, lifecyclePending);
  return (
    <fieldset disabled={disabled} aria-busy={pending} className="flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">Work item properties</legend>
      {display.state && (
        <div className="max-w-36">
          <InlineTaskState task={task} disabled={disabled} onChange={save} />
        </div>
      )}
      {display.priority && (
        <PriorityDropdown
          value={task.priority}
          onChange={(priority) => void save({ priority })}
          disabled={disabled}
          buttonVariant="border-without-text"
        />
      )}
      {display.assignee && (
        <div className="max-w-36">
          <InlineTaskAssignees task={task} disabled={disabled} onChange={save} />
        </div>
      )}
      {display.labels && <InlineTaskLabels task={task} disabled={disabled} onChange={save} />}
      {display.estimate && (
        <div className="max-w-28">
          <InlineTaskEstimate task={task} disabled={disabled} onChange={save} inline />
        </div>
      )}
      {display.start_date && (
        <DateDropdownView
          value={task.startDate}
          onChange={(value) => void save({ startDate: value ? renderFormattedPayloadDate(value) : null })}
          maxDate={getDate(task.targetDate) ?? undefined}
          weekStartsOn={profile?.preferences.startOfWeek}
          disabled={disabled || !profile}
          placeholder="Start date"
          buttonVariant="border-with-text"
          icon={<StartDatePropertyIcon className="size-3" />}
        />
      )}
      {display.due_date && (
        <DateDropdownView
          value={task.targetDate}
          onChange={(value) => void save({ targetDate: value ? renderFormattedPayloadDate(value) : null })}
          minDate={getDate(task.startDate) ?? undefined}
          weekStartsOn={profile?.preferences.startOfWeek}
          disabled={disabled || !profile}
          placeholder="Due date"
          buttonVariant="border-with-text"
          icon={<DueDatePropertyIcon className="size-3" />}
        />
      )}
      {display.created_on && (
        <span className="text-caption-sm-regular text-secondary" title="Created on">
          {renderFormattedDate(new Date(task._creationTime))}
        </span>
      )}
      {display.updated_on && (
        <span className="text-caption-sm-regular text-secondary" title="Updated on">
          {renderFormattedDate(new Date(task.updatedAt))}
        </span>
      )}
      <TaskRowCounts taskId={task._id} display={display} />
      {(display.cycle || display.modules) && <TaskRowMemberships taskId={task._id} display={display} />}
      {error && (
        <p role="alert" className="text-caption-sm-regular text-danger-primary">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function TaskRowCounts({
  taskId,
  display,
}: {
  taskId: InlinePropertyProps["task"]["_id"];
  display: FunctionReturnType<typeof api.tasks.profile.preferences>["displayProperties"];
}) {
  const links = usePaginatedQuery(api.tasks.links.list, display.link ? { taskId, deleted: false } : "skip", {
    initialNumItems: 100,
  });
  const attachments = usePaginatedQuery(
    api.assets.taskAttachments.list,
    display.attachment_count ? { taskId, deleted: false } : "skip",
    { initialNumItems: 100 }
  );
  const children = usePaginatedQuery(api.tasks.hierarchy.children, display.sub_issue_count ? { taskId } : "skip", {
    initialNumItems: 100,
  });
  const { status: linkStatus, loadMore: loadLinks } = links;
  const { status: attachmentStatus, loadMore: loadAttachments } = attachments;
  const { status: childStatus, loadMore: loadChildren } = children;
  useEffect(() => {
    if (linkStatus === "CanLoadMore") loadLinks(100);
    if (attachmentStatus === "CanLoadMore") loadAttachments(100);
    if (childStatus === "CanLoadMore") loadChildren(100);
  }, [linkStatus, loadLinks, attachmentStatus, loadAttachments, childStatus, loadChildren]);
  const counts = [
    { label: "Links", icon: LinkIcon, page: links, visible: display.link },
    { label: "Attachments", icon: Paperclip, page: attachments, visible: display.attachment_count },
    { label: "Sub-work items", icon: ViewsIcon, page: children, visible: display.sub_issue_count },
  ];
  return (
    <>
      {counts.map(
        ({ label, icon: Icon, page, visible }) =>
          visible &&
          page.status === "Exhausted" &&
          page.results.length > 0 && (
            <span
              key={label}
              title={label}
              className="inline-flex items-center gap-1 rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular"
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="sr-only">{label}: </span>
              {page.results.length}
            </span>
          )
      )}
    </>
  );
}

function TaskRowMemberships({
  taskId,
  display,
}: {
  taskId: InlinePropertyProps["task"]["_id"];
  display: FunctionReturnType<typeof api.tasks.profile.preferences>["displayProperties"];
}) {
  const cycle = useQuery(api.cycles.tasks.current, display.cycle ? { taskId } : "skip");
  const modules = usePaginatedQuery(api.modules.tasks.forTask, display.modules ? { taskId } : "skip", {
    initialNumItems: 100,
  });
  const { status, loadMore } = modules;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);
  return (
    <>
      {display.cycle && cycle && (
        <span className="rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular" title="Cycle">
          {cycle.name}
        </span>
      )}
      {display.modules &&
        modules.results.map((module) => (
          <span
            key={module._id}
            className="rounded-sm border border-subtle px-2 py-0.5 text-caption-sm-regular"
            title="Module"
          >
            {module.name}
          </span>
        ))}
    </>
  );
}
