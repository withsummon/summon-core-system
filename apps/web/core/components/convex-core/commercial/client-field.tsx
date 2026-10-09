import { useId } from "react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { Select } from "@plane/propel/select";
import { SummonField } from "@/components/summon/forms";

export function ClientField({
  workspaceId,
  value,
  onChange,
  currentClient,
  disabled = false,
}: {
  workspaceId: Id<"workspaces">;
  value: Id<"clients"> | null;
  onChange: (value: Id<"clients"> | null) => void;
  currentClient?: FunctionReturnType<typeof api.commercial.opportunities.get>["client"];
  disabled?: boolean;
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
        <Select
          id={fieldId}
          disabled={disabled}
          className="h-10"
          value={value ?? ""}
          onValueChange={(next) => {
            if (next === "") onChange(null);
            else {
              const client = results.find((item) => item._id === next);
              if (client) onChange(client._id);
            }
          }}
          options={[
            { value: "", label: "No client" },
            ...(value && !results.some((item) => item._id === value)
              ? [{ value, label: currentClient ? currentClient.companyName || currentClient.name : "Current client" }]
              : []),
            ...results.map((item) => ({ value: item._id, label: item.companyName || item.name })),
          ]}
        />
      </SummonField>
      {status === "LoadingFirstPage" && (
        <p role="status" className="text-11 text-secondary">
          Loading clients…
        </p>
      )}
      {status === "CanLoadMore" && (
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => loadMore(50)}>
          Load more clients
        </Button>
      )}
    </div>
  );
}
