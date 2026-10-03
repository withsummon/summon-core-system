import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { statusOptions } from "../tasks/options";
type Filters = FunctionArgs<typeof api.savedViews.index.create>["filters"];
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies Filters["priorities"];
export function BasicFilters({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  return (
    <div className="space-y-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-14 font-medium">Combine filter groups</legend>
        {(["all", "any"] as const).map((match) => (
          <label key={match} className="flex items-center gap-2 text-14">
            <input
              type="radio"
              name="filter-match"
              checked={filters.match === match}
              onChange={() => onChange({ ...filters, match })}
            />
            Match {match} groups
          </label>
        ))}
      </fieldset>
      <p className="text-12 text-secondary">
        Within each group, any selected value matches. An empty group does not restrict results.
      </p>
      <FilterChoices
        label="Status groups"
        options={statusOptions.map((option) => ({ id: option.value, label: option.label }))}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
      />
      <FilterChoices
        label="Priorities"
        options={priorities.map((priority) => ({ id: priority, label: priority }))}
        selected={filters.priorities}
        onChange={(selected) => onChange({ ...filters, priorities: selected })}
      />
      <fieldset className="space-y-3">
        <legend className="text-14 font-medium">Dates (inclusive)</legend>
        {(["startDate", "targetDate"] as const).map((key) => (
          <div key={key} className="grid gap-3 sm:grid-cols-2">
            <SummonField label={`${key === "startDate" ? "Start" : "Target"} date from`}>
              <Input
                type="date"
                value={filters[key]?.from ?? ""}
                onChange={(event) => {
                  const from = event.target.value || null;
                  const to = filters[key]?.to ?? null;
                  onChange({ ...filters, [key]: from || to ? { from, to } : null });
                }}
              />
            </SummonField>
            <SummonField label={`${key === "startDate" ? "Start" : "Target"} date through`}>
              <Input
                type="date"
                value={filters[key]?.to ?? ""}
                onChange={(event) => {
                  const to = event.target.value || null;
                  const from = filters[key]?.from ?? null;
                  onChange({ ...filters, [key]: from || to ? { from, to } : null });
                }}
              />
            </SummonField>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
export function FilterChoices<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-14 font-medium">{label}</legend>
      <div className="flex max-h-48 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
        {options.map((option) => (
          <label key={option.id} className="flex min-w-0 items-center gap-2 text-14">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))
              }
            />
            <span className="break-words">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
