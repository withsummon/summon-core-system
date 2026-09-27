import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { favoriteRoute } from "../favorites/route";
import { preferenceLabels, preferenceRoute, reorderPreferences } from "./routes";
type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
export function PersonalNavigation({ workspace, onNavigate }: { workspace: Workspace; onNavigate: () => void }) {
  const recent = useQuery(api.navigation.recent.list, { workspaceId: workspace._id });
  const prefs = useQuery(api.navigation.preferences.list, { workspaceId: workspace._id });
  const ensure = useMutation(api.navigation.preferences.ensure);
  const update = useMutation(api.navigation.preferences.update);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const initializedWorkspace = useRef("");
  useEffect(() => {
    if (prefs?.initialized !== false || initializedWorkspace.current === workspace._id) return;
    initializedWorkspace.current = workspace._id;
    setPending(true);
    setError("");
    void ensure({ workspaceId: workspace._id })
      .catch((cause) => setError(mutationMessage(cause)))
      .finally(() => setPending(false));
  }, [ensure, prefs?.initialized, workspace._id]);
  async function act(operation: () => Promise<unknown>) {
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(mutationMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      <section aria-label="Personal shortcuts" className="space-y-2">
        <h3 className="text-12 font-semibold text-secondary">SHORTCUTS</h3>
        {prefs?.initialized !== true && !error && (
          <p role="status" className="text-12 text-secondary">
            Setting up shortcuts…
          </p>
        )}
        {prefs?.preferences
          .filter((row) => row.isPinned)
          .map((row) => {
            const href = preferenceRoute(workspace.slug, row.key);
            return (
              <Link
                key={row.key}
                to={href}
                onClick={onNavigate}
                className="block rounded px-2 py-1.5 text-13 hover:bg-layer-2"
              >
                {preferenceLabels[row.key]}
              </Link>
            );
          })}
        <details>
          <summary className="cursor-pointer text-12 text-secondary">Customize shortcuts</summary>
          {prefs === undefined ? (
            <p role="status">Loading preferences…</p>
          ) : !prefs.initialized && error ? (
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => void act(() => ensure({ workspaceId: workspace._id }))}
            >
              Retry shortcut setup
            </Button>
          ) : prefs.initialized ? (
            <div className="mt-2 space-y-2">
              {prefs.preferences.map((row, index) => (
                <div key={row.key} className="flex flex-wrap items-center gap-1 text-12">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.isPinned}
                      disabled={pending}
                      onChange={(event) =>
                        void act(() =>
                          update({
                            workspaceId: workspace._id,
                            changes: [{ key: row.key, expectedRevision: row.revision, isPinned: event.target.checked }],
                          })
                        )
                      }
                    />
                    {preferenceLabels[row.key]}
                  </label>
                  <button
                    type="button"
                    disabled={pending || index === 0}
                    aria-label={`Move ${preferenceLabels[row.key]} up`}
                    onClick={() =>
                      void act(() =>
                        update({
                          workspaceId: workspace._id,
                          changes: reorderPreferences(prefs.preferences, index, -1),
                        })
                      )
                    }
                    className="rounded px-2 py-1 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === prefs.preferences.length - 1}
                    aria-label={`Move ${preferenceLabels[row.key]} down`}
                    onClick={() =>
                      void act(() =>
                        update({ workspaceId: workspace._id, changes: reorderPreferences(prefs.preferences, index, 1) })
                      )
                    }
                    className="rounded px-2 py-1 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </details>
        {error && (
          <p role="alert" className="text-12 text-danger-primary">
            {error}
          </p>
        )}
      </section>
      <section aria-label="Recently opened" className="space-y-2">
        <h3 className="text-12 font-semibold text-secondary">RECENT</h3>
        {recent === undefined ? (
          <p role="status" className="text-12 text-secondary">
            Loading recent items…
          </p>
        ) : recent.length === 0 ? (
          <p className="text-12 text-secondary">Opened projects, tasks and documents appear here.</p>
        ) : (
          recent.map((row) => {
            const href = favoriteRoute(workspace.slug, row);
            return (
              href && (
                <Link
                  key={row.id}
                  to={href}
                  onClick={onNavigate}
                  className="block rounded px-2 py-1.5 hover:bg-layer-2"
                >
                  <span className="block truncate text-13">{row.entity.name}</span>
                  <span className="text-11 text-secondary">
                    {row.target.type === "issue" ? "Task" : row.target.type === "page" ? "Document" : "Project"}
                    {row.entity.projectIdentifier && ` · ${row.entity.projectIdentifier}`}
                  </span>
                </Link>
              )
            );
          })
        )}
      </section>
    </div>
  );
}
