import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { OwnerField } from "@/components/convex-core/commercial/owner-field";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

export function ProjectProfileEditor({
  projectId,
  overview,
  onClose,
  onSaved,
}: {
  workspaceSlug: string;
  projectId: Id<"projects">;
  overview: FunctionReturnType<typeof api.reporting.overview.project>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [initial] = useState(overview.profile);
  const [form, setForm] = useState<FunctionArgs<typeof api.commercial.delivery.saveProfile>["data"]>(
    overview.profileForm
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const saveProfile = useMutation(api.commercial.delivery.saveProfile);
  const saveProject = useMutation(api.projects.form.save);
  const settings = useQuery(api.projects.form.get, { projectId });
  const clients = usePaginatedQuery(
    api.commercial.clients.list,
    { workspaceId: overview.project.workspaceId },
    { initialNumItems: 100 }
  );
  const { status: clientsStatus, loadMore: loadClients } = clients;
  useEffect(() => {
    if (clientsStatus === "CanLoadMore") loadClients(100);
  }, [clientsStatus, loadClients]);
  const release = useReloadConfirmations(dirty || saving, "This project profile has unsaved changes.", onClose, saving);
  const close = () => {
    if (saving) return;
    if (dirty) setDiscarding(true);
    else onClose();
  };
  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setError("");
  };
  if (!overview.canManage) return null;
  return (
    <section className="shadow-xs rounded-2xl border border-accent-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Edit project profile</h2>
          <p className="mt-1 text-[11px] text-secondary">
            Commercial metadata is saved separately from Plane project settings.
          </p>
        </div>
        <button type="button" onClick={close} disabled={saving} className="text-xs text-secondary hover:text-primary">
          Close
        </button>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            await saveProfile({ projectId, expectedUpdatedAt: initial?.updatedAt ?? null, data: form });
            setToast({
              type: TOAST_TYPE.SUCCESS,
              title: "Project profile saved",
              message: "The profile is now up to date.",
            });
            setDirty(false);
            release(() => onSaved());
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset disabled={saving} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label={initial?.sourceOpportunityId ? "Client (set by the won opportunity)" : "Client"}>
            <Select
              value={form.clientId ?? ""}
              disabled={Boolean(initial?.sourceOpportunityId)}
              onValueChange={(value) => {
                const client = clients.results.find((row) => row._id === value);
                if (value === "" || client) update("clientId", client?._id ?? null);
              }}
              options={[
                { value: "", label: "Not linked" },
                ...clients.results.map((client) => ({ value: client._id, label: client.companyName || client.name })),
              ]}
            />
          </Field>
          <Field label="Delivery status">
            <Select
              value={form.deliveryStatus}
              onValueChange={(value) => {
                const status = overview.options.deliveryStatus.find((entry) => entry === value);
                if (status) update("deliveryStatus", status);
              }}
              options={overview.options.deliveryStatus.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
            />
          </Field>
          <Field label="Phase">
            <input
              value={form.phase}
              maxLength={80}
              onChange={(event) => update("phase", event.target.value)}
              className={controlClass}
              placeholder="e.g. Delivery"
            />
          </Field>
          <Field label="Health">
            <Select
              value={form.health}
              onValueChange={(value) => {
                const health = overview.options.health.find((entry) => entry === value);
                if (health) update("health", health);
              }}
              options={overview.options.health.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
            />
          </Field>
          <Field label="Start date">
            <DatePicker value={form.startDate ?? ""} onValueChange={(value) => update("startDate", value || null)} />
          </Field>
          <Field label="Target date">
            <DatePicker
              value={form.targetDate ?? ""}
              min={form.startDate ?? undefined}
              onValueChange={(value) => update("targetDate", value || null)}
            />
          </Field>
          <Field label="Budget">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.budget ?? ""}
              onChange={(event) => update("budget", event.target.value || null)}
              className={controlClass}
              placeholder="0.00"
            />
          </Field>
          <OwnerField
            workspaceId={overview.project.workspaceId}
            value={settings?.input.leadId ?? null}
            label="Project manager"
            disabled={saving || !settings?.canManage}
            onChange={async (leadId) => {
              if (!settings) return;
              setSaving(true);
              setError("");
              try {
                await saveProject({
                  ...settings.input,
                  leadId,
                  expectedRevision: settings.revision,
                  expectedTimezone: settings.input.timezone,
                });
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setSaving(false);
              }
            }}
          />
        </fieldset>
        {error && (
          <p role="alert" className="text-xs mt-3 rounded-xl bg-danger-subtle px-3 py-2 text-danger-primary">
            {error}
          </p>
        )}
        {discarding && (
          <div role="alert" className="mt-3 flex items-center gap-3">
            <p>Discard this profile draft?</p>
            <button type="button" onClick={() => setDiscarding(false)}>
              Keep editing
            </button>
            <button type="button" onClick={() => release(() => onClose())}>
              Discard
            </button>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="text-xs rounded-xl border border-subtle px-4 py-2 text-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-xs rounded-xl bg-accent-primary px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}
const controlClass =
  "h-9 w-full rounded-xl border border-subtle bg-surface-1 px-3 text-12 text-primary outline-none focus:border-accent-strong";
