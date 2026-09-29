import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Dialog } from "@plane/propel/dialog";
import { ModalCore } from "@plane/ui";
import { useTranslation } from "@plane/i18n";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { ModulePersonPicker, ModuleStatusPicker } from "./controls";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
type Update = Pick<FunctionArgs<typeof api.modules.index.patch>, "expectedUpdatedAt" | "changes">;

function useModulePropertyDraft(module: Module, revision = module.updatedAt, onDone?: () => void) {
  const save = useMutation(api.modules.index.patch);
  const [draft, setDraft] = useState<Update | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const clear = useCallback(() => {
    setDraft(null);
    setError("");
    onDone?.();
  }, [onDone]);
  const release = useReloadConfirmations(draft !== null || pending, "This module has unsaved property changes.", clear);
  const submit = async (update: Update) => {
    setDraft(update);
    setPending(true);
    setError("");
    try {
      await save({ moduleId: module._id, ...update });
      release(clear);
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const schedule = (changes: Update["changes"]) => {
    setDraft((current) => ({
      expectedUpdatedAt: current?.expectedUpdatedAt ?? revision,
      changes: { ...current?.changes, ...changes },
    }));
    setError("");
  };
  const displayed = { ...module, ...draft?.changes };
  const readOnly = !module.canEdit || pending;
  return { draft, displayed, readOnly, pending, error, schedule, submit, clear: () => release(clear) };
}

export function ModuleProperties({ module }: { module: Module }) {
  const { draft, displayed, readOnly, pending, error, schedule, submit, clear } = useModulePropertyDraft(module);
  const disabled = readOnly || draft !== null;
  const dateDisabled = readOnly || !!error;
  return (
    <section aria-label="Module properties" className="space-y-3 border-b border-subtle pb-5">
      <div className="flex items-center gap-3">
        <span className="w-2/5 text-14 text-tertiary">Status</span>
        <ModuleStatusPicker
          value={displayed.status}
          disabled={disabled}
          onChange={(status) => void submit({ expectedUpdatedAt: module.updatedAt, changes: { status } })}
        />
      </div>
      <div className="flex items-start gap-3">
        <span className="w-2/5 text-14 text-tertiary">Lead</span>
        <ModulePersonPicker
          projectId={module.projectId}
          value={displayed.leadId}
          initial={module.lead}
          disabled={disabled}
          onChange={(leadId) => void submit({ expectedUpdatedAt: module.updatedAt, changes: { leadId } })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-12 text-secondary">
        <label htmlFor={`module-start-${module._id}`}>
          Start date
          <Input
            id={`module-start-${module._id}`}
            type="date"
            value={displayed.startDate ?? ""}
            disabled={dateDisabled}
            onChange={(event) => schedule({ startDate: event.target.value || null })}
          />
        </label>
        <label htmlFor={`module-target-${module._id}`}>
          Target date
          <Input
            id={`module-target-${module._id}`}
            type="date"
            value={displayed.targetDate ?? ""}
            disabled={dateDisabled}
            onChange={(event) => schedule({ targetDate: event.target.value || null })}
          />
        </label>
      </div>
      {draft && (
        <div className="flex gap-2">
          <Button size="sm" loading={pending} disabled={!module.canEdit} onClick={() => void submit(draft)}>
            {error ? "Retry" : "Save changes"}
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={clear}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      {draft && !module.canEdit && (
        <p className="text-13 text-secondary">This module is read-only. Your draft is retained.</p>
      )}
    </section>
  );
}

export function ModuleStatusDialog({
  module,
  expectedUpdatedAt,
  onClose,
}: {
  module: Module;
  expectedUpdatedAt: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { draft, displayed, readOnly, pending, error, submit, clear } = useModulePropertyDraft(
    module,
    expectedUpdatedAt,
    onClose
  );
  const [discarding, setDiscarding] = useState(false);
  const dismiss = () => {
    if (pending) return;
    if (draft) setDiscarding(true);
    else clear();
  };
  return (
    <ModalCore isOpen handleClose={dismiss}>
      <div className="space-y-4 p-5">
        <Dialog.Title className="text-18 font-medium">
          {t("power_k.contextual_actions.module.change_status")}
        </Dialog.Title>
        <ModuleStatusPicker
          value={displayed.status}
          disabled={readOnly || draft !== null}
          onChange={(status) => void submit({ expectedUpdatedAt, changes: { status } })}
        />
        {error && (
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
        )}
        {draft && !module.canEdit && (
          <p className="text-13 text-secondary">This module is read-only. Your draft is retained.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={dismiss}>
            {t("cancel")}
          </Button>
          {draft && (
            <Button loading={pending} disabled={!module.canEdit} onClick={() => void submit(draft)}>
              Retry
            </Button>
          )}
        </div>
        {discarding && (
          <div className="space-y-3 border-t border-subtle pt-4" role="alert">
            <p className="text-14">Discard this status change?</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDiscarding(false)}>
                Keep editing
              </Button>
              <Button variant="error-fill" onClick={clear}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalCore>
  );
}
