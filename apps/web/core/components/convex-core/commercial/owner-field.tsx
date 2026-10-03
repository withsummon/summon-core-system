import { useId } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { selectClass } from "./forms";

export function OwnerField({
  workspaceId,
  value,
  onChange,
  label = "Owner",
  disabled = false,
}: {
  workspaceId: Id<"workspaces">;
  value: Id<"users"> | null;
  onChange: (value: Id<"users"> | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  const fieldId = useId();
  const { results, status, loadMore } = usePaginatedQuery(
    api.commercial.directory.members,
    { workspaceId },
    { initialNumItems: 50 }
  );
  return (
    <div className="space-y-2">
      <SummonField label={label} htmlFor={fieldId}>
        <select
          id={fieldId}
          className={selectClass}
          value={value ?? ""}
          disabled={disabled}
          onChange={(event) => {
            if (!event.target.value) onChange(null);
            else {
              const owner = results.find((user) => user.id === event.target.value);
              if (owner) onChange(owner.id);
            }
          }}
        >
          <option value="">Unassigned</option>
          {value && !results.some((user) => user.id === value) && <option value={value}>Current owner</option>}
          {results.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name || user.email || user.id}
            </option>
          ))}
        </select>
      </SummonField>
      {status === "CanLoadMore" && (
        <Button variant="secondary" disabled={disabled} onClick={() => loadMore(50)}>
          Load more owners
        </Button>
      )}
    </div>
  );
}
