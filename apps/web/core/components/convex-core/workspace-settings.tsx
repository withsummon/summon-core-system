import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";

type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
type Settings = FunctionReturnType<typeof api.settings.index.get>;
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  const settings = useQuery(api.settings.index.get, { workspaceId: workspace._id });
  const [editing, setEditing] = useState(false);
  if (!settings) return <p role="status">Loading workspace settings…</p>;
  return (
    <section className="max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Workspace settings</h1>
        {workspace.membershipRole === "admin" && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit settings
          </Button>
        )}
      </header>
      {editing && workspace.membershipRole === "admin" ? (
        <SettingsForm workspace={workspace} initial={settings} onClose={() => setEditing(false)} />
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries({
            Name: settings.name,
            Slug: settings.slug,
            "Organization size": settings.organizationSize,
            Timezone: settings.timezone,
            Industry: settings.industry,
            Currency: settings.currency,
            Workweek: settings.workweek.join(", "),
            Description: settings.description,
          }).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-secondary">{label}</dt>
              <dd className="mt-1 break-words whitespace-pre-wrap">{value || "Not set"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function SettingsForm({
  workspace,
  initial,
  onClose,
}: {
  workspace: Workspace;
  initial: Settings;
  onClose: () => void;
}) {
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.settings.index.save);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const { slug: _slug, ...fields } = data;
        void save({ workspaceId: workspace._id, ...fields })
          .then(onClose)
          .catch(() => setError("Could not save settings. Check the timezone, currency, and your current access."))
          .finally(() => setPending(false));
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummonField label="Workspace name">
          <Input
            value={data.name}
            required
            maxLength={80}
            onChange={(event) => setData({ ...data, name: event.target.value })}
          />
        </SummonField>
        <SummonField label="Organization size">
          <Input
            value={data.organizationSize ?? ""}
            maxLength={20}
            onChange={(event) => setData({ ...data, organizationSize: event.target.value || null })}
          />
        </SummonField>
        <SummonField label="Timezone">
          <Input
            value={data.timezone}
            required
            placeholder="Asia/Jakarta"
            onChange={(event) => setData({ ...data, timezone: event.target.value })}
          />
        </SummonField>
        <SummonField label="Industry">
          <Input
            value={data.industry}
            maxLength={120}
            onChange={(event) => setData({ ...data, industry: event.target.value })}
          />
        </SummonField>
        <SummonField label="Currency">
          <Input
            value={data.currency}
            required
            pattern="[A-Z]{3}"
            maxLength={3}
            onChange={(event) => setData({ ...data, currency: event.target.value.toUpperCase() })}
          />
        </SummonField>
      </div>
      <fieldset>
        <legend className="text-sm mb-2 text-secondary">Workweek</legend>
        <div className="flex flex-wrap gap-4">
          {weekdays.map((day) => (
            <label className="flex items-center gap-2" key={day}>
              <input
                type="checkbox"
                checked={data.workweek.includes(day)}
                onChange={(event) =>
                  setData({
                    ...data,
                    workweek: event.target.checked
                      ? [...data.workweek, day]
                      : data.workweek.filter((value) => value !== day),
                  })
                }
              />
              <span className="capitalize">{day}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <SummonField label="Description">
        <textarea
          className="min-h-28 rounded-md border border-subtle-1 bg-layer-1 p-3 text-primary"
          value={data.description}
          maxLength={100000}
          onChange={(event) => setData({ ...data, description: event.target.value })}
        />
      </SummonField>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <Button variant="secondary" type="button" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
