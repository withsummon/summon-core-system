import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Dialog } from "@plane/propel/dialog";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage } from "../commercial/forms";
import { ModuleMemberChoices, ModulePersonPicker, ModuleStatusPicker } from "./controls";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
type Module = FunctionReturnType<typeof api.modules.index.get>;
type Fields = Omit<FunctionArgs<typeof api.modules.index.create>, "projectId" | "memberIds">;

export function ModuleFormModal({
  projectId,
  module,
  snapshot,
  onDone,
  onClose,
}: {
  projectId: Id<"projects">;
  module: Module | null;
  onDone: (id: Id<"modules">, allowDefaultNavigation: boolean) => void;
  onClose: () => void;
  snapshot?: Module;
}) {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const leave = useCallback(() => onClose(), [onClose]);
  const release = useReloadConfirmations(dirty || busy, "This module has unsaved changes.", leave, busy);
  const dismiss = () => {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  };
  return (
    <ModalCore isOpen handleClose={dismiss} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <Dialog.Title className="px-5 pt-5 text-18 font-medium text-secondary">
        {module ? "Update module" : "Create module"}
      </Dialog.Title>
      <ModuleForm
        projectId={projectId}
        module={module}
        snapshot={snapshot}
        onDone={(id) => release((allow) => onDone(id, allow))}
        onCancel={dismiss}
        onBusy={setBusy}
        onDirty={setDirty}
      />
      {discarding && (
        <div className="space-y-3 border-t border-subtle p-5" role="alert">
          <p className="text-14">Discard this module draft?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDiscarding(false)}>
              Keep editing
            </Button>
            <Button variant="error-fill" onClick={() => release(() => onClose())}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </ModalCore>
  );
}

export function ModuleForm({
  projectId,
  module,
  snapshot,
  onDone,
  onCancel,
  onBusy,
  onDirty,
}: {
  projectId: Id<"projects">;
  module: Module | null;
  onDone: (id: Id<"modules">) => void;
  onCancel: () => void;
  onBusy?: (busy: boolean) => void;
  onDirty?: (dirty: boolean) => void;
  snapshot?: Module;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.modules.index.create);
  const update = useMutation(api.modules.index.update);
  const catalogue = useQuery(api.modules.index.catalogue, module ? "skip" : { projectId });
  const [initial] = useState(snapshot ?? module);
  const [initialFields] = useState<Fields>(() =>
    initial
      ? {
          name: initial.name,
          descriptionHtml: initial.descriptionHtml,
          status: initial.status,
          startDate: initial.startDate,
          targetDate: initial.targetDate,
          leadId: initial.leadId,
        }
      : { name: "", descriptionHtml: "", status: "backlog", startDate: null, targetDate: null, leadId: null }
  );
  const [draft, setDraft] = useState(initialFields);
  const [members, setMembers] = useState<Id<"users">[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const writable = module === null ? catalogue?.canWrite === true : module.canEdit;
  const disabled = pending || !writable;
  const change = (fields: Partial<Fields>) => {
    const next = { ...draft, ...fields };
    setDraft(next);
    onDirty?.(JSON.stringify(next) !== JSON.stringify(initialFields) || members.length > 0);
  };
  return (
    <form
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled) return;
        setPending(true);
        onBusy?.(true);
        setError("");
        try {
          let id: Id<"modules">;
          if (initial) {
            await update({ moduleId: initial._id, expectedUpdatedAt: initial.updatedAt, ...draft });
            id = initial._id;
          } else id = await create({ projectId, ...draft, memberIds: members });
          onDirty?.(false);
          onDone(id);
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
          onBusy?.(false);
        }
      }}
    >
      <div className="space-y-5 p-5">
        <fieldset disabled={disabled} className="space-y-3">
          <label className="sr-only" htmlFor="module-name">
            Module name
          </label>
          <Input
            id="module-name"
            required
            maxLength={255}
            value={draft.name}
            onChange={(event) => change({ name: event.target.value })}
            placeholder={t("title")}
            className="w-full text-14"
          />
          <TaskRichEditor
            id={"module-form-" + (initial?._id ?? "new")}
            label="Module description"
            placeholder={t("description")}
            html={initialFields.descriptionHtml}
            editable={!disabled}
            onChange={(descriptionHtml) => change({ descriptionHtml })}
          />
          <div className="flex flex-wrap items-start gap-2">
            <label htmlFor="module-form-start" className="space-y-1 text-11 text-secondary">
              {t("start_date")}
              <Input
                id="module-form-start"
                type="date"
                aria-label="Start date"
                value={draft.startDate ?? ""}
                onChange={(event) => change({ startDate: event.target.value || null })}
                className="h-7 text-11"
              />
            </label>
            <label htmlFor="module-form-target" className="space-y-1 text-11 text-secondary">
              {t("end_date")}
              <Input
                id="module-form-target"
                type="date"
                aria-label="Target date"
                value={draft.targetDate ?? ""}
                onChange={(event) => change({ targetDate: event.target.value || null })}
                className="h-7 text-11"
              />
            </label>
            <ModuleStatusPicker value={draft.status} onChange={(status) => change({ status })} disabled={disabled} />
            <ModulePersonPicker
              projectId={projectId}
              value={draft.leadId}
              initial={initial?.lead}
              onChange={(leadId) => change({ leadId })}
              disabled={disabled}
            />
            {!initial && (
              <ModuleMemberChoices
                projectId={projectId}
                value={members}
                onChange={(value) => {
                  setMembers(value);
                  onDirty?.(value.length > 0 || JSON.stringify(draft) !== JSON.stringify(initialFields));
                }}
                disabled={disabled}
              />
            )}
          </div>
        </fieldset>
        {!writable && <p className="text-14 text-secondary">This module is read-only. Your draft is retained.</p>}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-subtle px-5 py-4">
        <Button variant="secondary" size="lg" disabled={pending} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="lg" loading={pending} disabled={!writable}>
          {initial ? t("project_module.update_module") : t("project_module.create_module")}
        </Button>
      </div>
    </form>
  );
}
