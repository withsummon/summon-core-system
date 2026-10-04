import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { MODULE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { ModuleStatusIcon, MembersPropertyIcon } from "@plane/propel/icons";
import { Popover } from "@plane/propel/popover";
import { CustomSelect } from "@plane/ui";

type Module = FunctionReturnType<typeof api.modules.index.get>;
type Person = FunctionReturnType<typeof api.modules.members.choices>["page"][number];

export function ModuleStatusPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Module["status"];
  onChange: (value: Module["status"]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const selected = MODULE_STATUS.find((option) => option.value === value);
  return (
    <CustomSelect<Module["status"]>
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
      disabled={disabled}
      ariaLabel="Module status"
      label={
        <span className="flex items-center gap-2">
          <ModuleStatusIcon status={value} />
          {selected && t(selected.i18n_label)}
        </span>
      }
    >
      {MODULE_STATUS.map((status) => (
        <CustomSelect.Option key={status.value} value={status.value}>
          <span className="flex items-center gap-2">
            <ModuleStatusIcon status={status.value} />
            {t(status.i18n_label)}
          </span>
        </CustomSelect.Option>
      ))}
    </CustomSelect>
  );
}

export function ModulePersonPicker({
  projectId,
  value,
  onChange,
  initial,
  disabled = false,
  label = "Module lead",
}: {
  projectId: Id<"projects">;
  value: Id<"users"> | null;
  onChange: (value: Id<"users"> | null) => void;
  initial?: Person | null;
  disabled?: boolean;
  label?: string;
}) {
  const people = usePaginatedQuery(api.modules.members.choices, { projectId }, { initialNumItems: 30 });
  const choices =
    initial && !people.results.some((person) => person.userId === initial.userId)
      ? [initial, ...people.results]
      : people.results;
  const selected = choices.find((person) => person.userId === value);
  return (
    <div className="space-y-2">
      <CustomSelect<Id<"users"> | null>
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={label}
        label={selected ? selected.name : label}
      >
        <CustomSelect.Option value={null}>None</CustomSelect.Option>
        {choices.map((person) => (
          <CustomSelect.Option key={person.userId} value={person.userId}>
            {person.name}
          </CustomSelect.Option>
        ))}
      </CustomSelect>
      {people.status === "CanLoadMore" && (
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => people.loadMore(30)}>
          Load more people
        </Button>
      )}
    </div>
  );
}

export function ModuleMemberChoices({
  projectId,
  value,
  onChange,
  disabled = false,
  label = "Members",
}: {
  projectId: Id<"projects">;
  value: Id<"users">[];
  onChange: (value: Id<"users">[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const people = usePaginatedQuery(api.modules.members.choices, { projectId }, { initialNumItems: 30 });
  const [search, setSearch] = useState("");
  return (
    <Popover>
      <Popover.Button
        disabled={disabled}
        aria-label={label}
        className="flex h-7 items-center gap-2 rounded border border-strong px-2 text-11"
      >
        <MembersPropertyIcon className="size-3.5" />
        {label}
        {value.length > 0 && ` (${value.length})`}
      </Popover.Button>
      <Popover.Panel
        side="bottom"
        align="start"
        sideOffset={4}
        positionerClassName="z-[120]"
        className="w-64 rounded-md border border-subtle bg-surface-1 p-2 shadow-raised-200"
      >
        <input
          aria-label={`Search ${label.toLowerCase()} choices`}
          placeholder="Search people"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-2 w-full rounded border border-subtle bg-transparent px-2 py-1 text-13"
        />
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {people.results
            .filter((person) => person.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
            .map((person) => (
              <li key={person.userId}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-13 hover:bg-layer-transparent-hover">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={value.includes(person.userId)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked ? [...value, person.userId] : value.filter((id) => id !== person.userId)
                      )
                    }
                  />
                  <span className="truncate">{person.name}</span>
                </label>
              </li>
            ))}
        </ul>
        {people.status === "CanLoadMore" && (
          <Button variant="ghost" size="sm" onClick={() => people.loadMore(30)}>
            Load more people
          </Button>
        )}
        {people.status === "LoadingFirstPage" && (
          <p role="status" className="text-13 text-secondary">
            Loading people…
          </p>
        )}
      </Popover.Panel>
    </Popover>
  );
}
