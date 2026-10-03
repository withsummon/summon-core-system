import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { projectTabs } from "@summon/convex/project-navigation";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type Preferences = FunctionReturnType<typeof api.projects.navigation.get>;
export function ProjectNavigation({
  projectId,
  preferences,
  active,
  onSelect,
}: {
  projectId: Id<"projects">;
  preferences: Preferences;
  active: string;
  onSelect: (view: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const tabs = Object.values(projectTabs);
  const visible = tabs.filter((tab) => !preferences.navigation.hiddenTabs.includes(tab.key));
  const hidden = tabs.filter((tab) => preferences.navigation.hiddenTabs.includes(tab.key));
  const hiddenActive = hidden.find((tab) => tab.view === active);
  const tabButton = (tab: (typeof tabs)[number]) => (
    <Button
      key={tab.key}
      variant={active === tab.view ? "primary" : "secondary"}
      aria-current={active === tab.view ? "page" : undefined}
      onClick={() => onSelect(tab.view)}
    >
      {tab.label}
    </Button>
  );
  return (
    <div className="min-w-0 space-y-3">
      <nav aria-label="Project sections" className="flex flex-wrap items-start gap-2">
        {visible.map(tabButton)}
        {hidden.length > 0 && (
          <details className="max-w-full rounded-md border border-subtle-1 px-3 py-2 text-14">
            <summary className="cursor-pointer">More{hiddenActive ? ` · ${hiddenActive.label}` : ""}</summary>
            <div className="mt-3 flex flex-wrap gap-2">{hidden.map(tabButton)}</div>
          </details>
        )}
        <Button
          variant={active === "settings" ? "primary" : "secondary"}
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => onSelect("settings")}
        >
          Settings
        </Button>
        <Button variant="tertiary" onClick={() => setEditing(true)}>
          Customize tabs
        </Button>
      </nav>
      {editing && <NavigationForm projectId={projectId} initial={preferences} onDone={() => setEditing(false)} />}
    </div>
  );
}
function NavigationForm({
  projectId,
  initial,
  onDone,
}: {
  projectId: Id<"projects">;
  initial: Preferences;
  onDone: () => void;
}) {
  const [snapshot] = useState(initial);
  const [draft, setDraft] = useState(() => ({
    ...snapshot.navigation,
    hiddenTabs: [...snapshot.navigation.hiddenTabs],
  }));
  const revision = snapshot.revision;
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const save = useMutation(api.projects.navigation.save),
    reset = useMutation(api.projects.navigation.reset);
  const persist = async (clear: boolean) => {
    setPending(true);
    setError("");
    try {
      if (clear) await reset({ projectId, expectedRevision: revision });
      else await save({ projectId, expectedRevision: revision, navigation: draft });
      onDone();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      className="space-y-4 rounded-lg border border-subtle-1 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void persist(false);
      }}
    >
      <h3 className="text-16 font-medium">Your project tabs</h3>
      <SummonField label="Open this tab by default" htmlFor="default-project-tab">
        <select
          id="default-project-tab"
          className={selectClass}
          value={draft.defaultTab}
          disabled={pending}
          onChange={(event) => {
            const selected = Object.values(projectTabs).find((tab) => tab.key === event.target.value);
            if (selected) setDraft({ ...draft, defaultTab: selected.key });
          }}
        >
          {Object.values(projectTabs).map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.label}
            </option>
          ))}
        </select>
      </SummonField>
      <fieldset className="space-y-2" disabled={pending}>
        <legend className="text-14 font-medium">Move to More</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {Object.values(projectTabs).map((tab) => (
            <label key={tab.key} className="flex items-center gap-2 text-14">
              <input
                type="checkbox"
                checked={draft.hiddenTabs.includes(tab.key)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    hiddenTabs: event.target.checked
                      ? [...draft.hiddenTabs, tab.key]
                      : draft.hiddenTabs.filter((key) => key !== tab.key),
                  })
                }
              />
              {tab.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-12 text-secondary">
        Only your navigation changes. Direct links still open their selected section.
      </p>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Save tabs
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !snapshot.hasOverride}
          onClick={() => void persist(true)}
        >
          Reset navigation
        </Button>
      </div>
    </form>
  );
}
