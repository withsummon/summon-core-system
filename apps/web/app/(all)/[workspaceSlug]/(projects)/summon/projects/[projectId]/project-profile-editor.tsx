import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISummonProjectOverview, IUserLite } from "@plane/types";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { projectProfileDateError } from "@/components/summon/projects/project-workspace";
import { summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { summonService } from "@/services/summon.service";

type TProfileForm = {
  client: string;
  delivery_status: string;
  phase: string;
  health: string;
  start_date: string;
  target_date: string;
  budget: string;
};

const profileForm = (profile: ISummonProjectOverview["profile"]): TProfileForm => ({
  client: profile?.client || "",
  delivery_status: profile?.delivery_status || "planning",
  phase: profile?.phase || "",
  health: profile?.health || "on_track",
  start_date: profile?.start_date || "",
  target_date: profile?.target_date || "",
  budget: profile?.budget || "",
});

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
  const { data: clients = [] } = useSWR(["summon-project-profile-clients", workspaceSlug], () =>
    summonService.listClients(workspaceSlug)
  );
  const [form, setForm] = useState(() => profileForm(profile));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const project = getProjectById(projectId);
  const projectLead = project?.project_lead;
  const projectLeadId = typeof projectLead === "object" ? (projectLead as IUserLite).id : projectLead || null;
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  useEffect(() => setForm(profileForm(profile)), [profile]);

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
    const payload = {
      ...form,
      client: form.client || null,
      start_date: form.start_date || null,
      target_date: form.target_date || null,
      budget: form.budget || null,
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
    <section className="shadow-xs rounded-2xl border border-accent-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Edit project profile</h2>
          <p className="mt-1 text-[11px] text-secondary">
            Commercial metadata is saved separately from Plane project settings.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-secondary hover:text-primary">
          Close
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Client">
          <select
            value={form.client}
            onChange={(event) => updateField("client", event.target.value)}
            className={controlClass}
          >
            <option value="">Not linked</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company_name || client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Delivery status">
          <select
            value={form.delivery_status}
            onChange={(event) => updateField("delivery_status", event.target.value)}
            className={controlClass}
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
        <Field label="Phase">
          <input
            value={form.phase}
            maxLength={80}
            onChange={(event) => updateField("phase", event.target.value)}
            className={controlClass}
            placeholder="e.g. Delivery"
          />
        </Field>
        <Field label="Health">
          <select
            value={form.health}
            onChange={(event) => updateField("health", event.target.value)}
            className={controlClass}
          >
            <option value="on_track">On track</option>
            <option value="at_risk">At risk</option>
            <option value="off_track">Off track</option>
          </select>
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={form.start_date}
            onChange={(event) => updateField("start_date", event.target.value)}
            className={controlClass}
          />
        </Field>
        <Field label="Target date">
          <input
            type="date"
            value={form.target_date}
            min={form.start_date || undefined}
            onChange={(event) => updateField("target_date", event.target.value)}
            className={controlClass}
          />
        </Field>
        <Field label="Budget">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.budget}
            onChange={(event) => updateField("budget", event.target.value)}
            className={controlClass}
            placeholder="0.00"
          />
        </Field>
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
        <p role="alert" className="text-xs bg-red-50 text-red-600 mt-3 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="text-xs rounded-xl border border-subtle px-4 py-2 text-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={saving}
          className="text-xs rounded-xl bg-accent-primary px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </section>
  );
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

const controlClass =
  "h-9 w-full rounded-xl border border-subtle bg-surface-1 px-3 text-xs text-primary outline-none focus:border-accent-strong";
