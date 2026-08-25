import { Button } from "@plane/ui";
import type { ISummonAssistantAction } from "@plane/types";

export function AssistantActionCard(props: {
  action: ISummonAssistantAction;
  busy: boolean;
  anyBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { action } = props;
  return (
    <div className="rounded-xl border border-subtle bg-layer-1 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">{action.preview.title ?? "Plane MCP action"}</p>
          <p className="text-xs mt-1 text-secondary">{action.preview.summary ?? action.tool}</p>
        </div>
        <span className="rounded-full bg-surface-1 px-2 py-1 text-[10px] font-medium text-secondary uppercase">
          {action.status}
        </span>
      </div>
      {action.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" loading={props.busy} onClick={props.onConfirm}>
            Confirm
          </Button>
          <Button size="sm" variant="neutral-primary" disabled={props.anyBusy} onClick={props.onCancel}>
            Cancel
          </Button>
        </div>
      ) : null}
      {action.error ? <p className="text-xs mt-2 text-danger-primary">{action.error}</p> : null}
    </div>
  );
}
