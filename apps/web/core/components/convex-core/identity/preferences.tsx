import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type Profile = FunctionReturnType<typeof api.identity.profile.get>;
const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "light-contrast", label: "Light contrast" },
  { value: "dark-contrast", label: "Dark contrast" },
];
export function PreferencesForm({ initial, onClose }: { initial: Profile; onClose: () => void }) {
  const [snapshot] = useState(initial);
  const [draft, setDraft] = useState(initial.preferences);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const save = useMutation(api.identity.preferences.save);
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({ expectedRevision: snapshot.revision, preferences: draft });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-16 font-medium">Preferences</h3>
      {initial.revision !== snapshot.revision && (
        <p role="status" className="text-12">
          Your account changed elsewhere. Your edits are kept; reopen this form to use the latest saved values.
        </p>
      )}
      <fieldset disabled={pending} className="space-y-4">
        <SummonField label="Appearance" htmlFor="profile-theme">
          <select
            id="profile-theme"
            className={selectClass}
            value={draft.theme.theme ?? ""}
            onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, theme: event.target.value } })}
          >
            {!draft.theme.theme && <option value="">Current browser appearance</option>}
            {draft.theme.theme === "custom" && <option value="custom">Saved custom theme</option>}
            {themes.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="Notification density" htmlFor="profile-notification-mode">
          <select
            id="profile-notification-mode"
            className={selectClass}
            value={draft.notificationViewMode}
            onChange={(event) => {
              if (event.target.value === "full" || event.target.value === "compact")
                setDraft({ ...draft, notificationViewMode: event.target.value });
            }}
          >
            <option value="full">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </SummonField>
        <SummonField label="Job role" htmlFor="profile-job-role">
          <Input
            id="profile-job-role"
            maxLength={300}
            value={draft.jobRole ?? ""}
            onChange={(event) => setDraft({ ...draft, jobRole: event.target.value || null })}
          />
        </SummonField>
        <SummonField label="What do you use Summon for?" htmlFor="profile-use-case">
          <textarea
            id="profile-use-case"
            className={selectClass}
            rows={3}
            maxLength={20000}
            value={draft.useCase ?? ""}
            onChange={(event) => setDraft({ ...draft, useCase: event.target.value || null })}
          />
        </SummonField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            Save preferences
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel preferences
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
