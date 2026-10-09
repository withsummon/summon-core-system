import { CloseIcon } from "@plane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { useIssueFilter } from "@/hooks/store/use-issue-filter";

export function IssueAppliedFilters() {
  const { t } = useTranslation();
  const { selectedStates, selectedLabels, selectedPriorities, catalog, change, clear } = useIssueFilter();
  if (!selectedStates.length && !selectedLabels.length && !selectedPriorities.length) return null;
  return (
    <div className="border-b border-subtle bg-surface-1 p-4">
      <div className="flex flex-wrap items-stretch gap-2">
        {selectedStates.map((id) => (
          <span
            key={`state-${id}`}
            className="flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-11"
          >
            State: {catalog?.states.find((state) => state._id === id)?.name ?? "Unavailable state"}
            <button type="button" aria-label="Remove state filter" onClick={() => change("state", id)}>
              <CloseIcon className="size-3" />
            </button>
          </span>
        ))}
        {selectedPriorities.map((value) => (
          <span
            key={`priority-${value}`}
            className="flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-11 capitalize"
          >
            Priority: {value}
            <button type="button" aria-label="Remove priority filter" onClick={() => change("priority", value)}>
              <CloseIcon className="size-3" />
            </button>
          </span>
        ))}
        {selectedLabels.map((id) => (
          <span
            key={`label-${id}`}
            className="flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-11"
          >
            Label: {catalog?.labels.find((label) => label._id === id)?.name ?? "Unavailable label"}
            <button type="button" aria-label="Remove label filter" onClick={() => change("labels", id)}>
              <CloseIcon className="size-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-2 rounded-md border border-subtle px-2 py-1 text-11 text-tertiary hover:text-secondary"
        >
          {t("common.clear_all")}
          <CloseIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}
