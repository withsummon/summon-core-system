import { useId } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { selectClass } from "./forms";

export function ClientField({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: Id<"workspaces">;
  value: Id<"clients"> | null;
  onChange: (value: Id<"clients"> | null) => void;
}) {
  const fieldId = useId();
  const { results, status, loadMore } = usePaginatedQuery(
    api.commercial.clients.list,
    { workspaceId },
    { initialNumItems: 50 }
  );
  return (
    <div className="space-y-2">
      <SummonField label="Client" htmlFor={fieldId}>
        <select
          id={fieldId}
          className={selectClass}
          value={value ?? ""}
          onChange={(event) => {
            if (!event.target.value) onChange(null);
            else {
              const client = results.find((item) => item._id === event.target.value);
              if (client) onChange(client._id);
            }
          }}
        >
          <option value="">No client</option>
          {value && !results.some((item) => item._id === value) && <option value={value}>Current client</option>}
          {results.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </select>
      </SummonField>
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more clients
        </Button>
      )}
    </div>
  );
}
