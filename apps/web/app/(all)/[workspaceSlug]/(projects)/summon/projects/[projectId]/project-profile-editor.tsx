import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISummonProjectOverview } from "@plane/types";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { projectProfileDateError, projectProfileForm } from "@/components/summon/projects/project-workspace";
import { MoneyInput } from "@/components/summon/money-input";
import { summonErrorMessage } from "@/components/summon/screen";
import { useSummonAccess } from "@/components/summon/use-summon-access";
import { useWorkspaceCurrency } from "@/components/summon/use-workspace-money";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";

type TProfileForm = {
  client: string;
  delivery_status: string;
  phase: string;
  health: string;
  start_date: string;
  target_date: string;
  budget: string;
};

export const ProjectProfileEditor = observer(function ProjectProfileEditor(props: {
  workspaceSlug: string;
  projectId: string;
  profile: ISummonProjectOverview["profile"];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { workspaceSlug, projectId, profile, onClose, onSaved } = props;
  const { allowPermissions } = useUserPermissions();
  const { getProjectById, updateProject } = useProject();
  const { data: clients = [] } = useSWR(["summon-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const currency = useWorkspaceCurrency(workspaceSlug);
  const [form, setForm] = useState<TProfileForm>(() => projectProfileForm(profile));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const project = getProjectById(projectId);
  const projectLead = project?.project_lead;
  const projectLeadId = typeof projectLead === "object" ? (projectLead?.id ?? null) : projectLead || null;
  const showBudget = useSummonAccess(workspaceSlug).can("commercial.view");
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  useEffect(() => setForm(projectProfileForm(profile)), [profile]);

  const updateField = (field: keyof TProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const saveProfile = async () => {
    const dateError = projectProfileDateError(form.start_date, form.target_date);
    if (dateError) {
      setError(dateError);
      return;
    }
    setSaving(true);
    setError("");
    const { client, budget, ...rest } = form;
    const payload = {
      ...rest,
      // The server keeps a linked profile's client in step with its source opportunity.
      ...(profile?.source_opportunity ? {} : { client: client || null }),
      start_date: form.start_date || null,
      target_date: form.target_date || null,
      ...(showBudget ? { budget: budget || null } : {}),
    };
    try {
      if (profile) await summonService.updateProjectProfile(workspaceSlug, projectId, payload);
      else await summonService.createProjectProfile(workspaceSlug, projectId, payload);
      await onSaved();
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Project profile saved", message: "The profile is now up to date." });
      onClose();
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const saveProjectLead = async (memberId: string | null) => {
    setLeadSaving(true);
    setError("");
    try {
      await updateProject(workspaceSlug, projectId, { project_lead: memberId });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Project manager updated", message: "The new manager was saved." });
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setLeadSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <section className="rounded-lg border border-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Edit project profile</h2>
          <p className="mt-1 text-xs text-secondary">
            Update delivery details. Changes to the project manager save immediately.
          </p>
        </div>
        <Button variant="ghost" size="base" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={profile?.source_opportunity ? "Client (set by the won opportunity)" : "Client"}>
          <Select
            value={form.client}
            onValueChange={(value) => updateField("client", value)}
            disabled={Boolean(profile?.source_opportunity)}
            options={[
              { value: "", label: "Not linked" },
              ...clients.map((client) => ({ value: client.id, label: client.company_name || client.name })),
            ]}
          />
        </Field>
        <Field label="Delivery status">
          <Select
            value={form.delivery_status}
            onValueChange={(value) => updateField("delivery_status", value)}
            options={[
              { value: "not_assessed", label: "Not assessed" },
              { value: "planning", label: "Planning" },
              { value: "active", label: "Active" },
              { value: "on_hold", label: "On hold" },
              { value: "completed", label: "Completed" },
            ]}
          />
        </Field>
        <Field label="Phase">
          <Input
            value={form.phase}
            maxLength={80}
            onChange={(event) => updateField("phase", event.target.value)}
            className="w-full text-base sm:text-sm"
            placeholder="e.g. Delivery"
          />
        </Field>
        <Field label="Health">
          <Select
            value={form.health}
            onValueChange={(value) => updateField("health", value)}
            options={[
              { value: "not_assessed", label: "Not assessed" },
              { value: "on_track", label: "On track" },
              { value: "at_risk", label: "At risk" },
              { value: "off_track", label: "Off track" },
            ]}
          />
        </Field>
        <Field label="Start date">
          <DatePicker value={form.start_date} onValueChange={(value) => updateField("start_date", value)} />
        </Field>
        <Field label="Target date">
          <DatePicker
            value={form.target_date}
            min={form.start_date || undefined}
            onValueChange={(value) => updateField("target_date", value)}
          />
        </Field>
        {showBudget ? (
          <Field label="Budget">
            <MoneyInput
              value={form.budget}
              onValueChange={(value) => updateField("budget", value)}
              currency={currency}
              className="text-base sm:text-sm"
              placeholder="0"
            />
          </Field>
        ) : null}
        <Field label="Project manager">
          <div className="h-9">
            <MemberDropdown
              projectId={projectId}
              value={projectLeadId}
              onChange={(value) => void saveProjectLead(value)}
              multiple={false}
              disabled={leadSaving}
              buttonVariant="border-with-text"
              buttonClassName="h-9 w-full"
              dropdownArrow
              showUserDetails
              placeholder="Not assigned"
            />
          </div>
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-primary">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void saveProfile()} loading={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </section>
  );
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}
