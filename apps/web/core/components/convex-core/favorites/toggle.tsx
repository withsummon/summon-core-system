import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Star } from "lucide-react";
import { mutationMessage } from "../commercial/forms";
type Target = FunctionArgs<typeof api.favorites.index.state>["target"];
export function FavoriteToggle({ workspaceId, target }: { workspaceId: Id<"workspaces">; target: Target }) {
  const access = useQuery(api.favorites.index.access, { workspaceId });
  const enabled = access?.canManage && (target.type !== "view" || access.canManageViews);
  const state = useQuery(api.favorites.index.state, enabled ? { workspaceId, target } : "skip");
  const create = useMutation(api.favorites.index.create),
    lifecycle = useMutation(api.favorites.index.lifecycle);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!enabled || !state?.canFavorite) return null;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        disabled={pending || state.blockedByFolder}
        aria-pressed={state.isFavorite}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            if (state.favorite)
              await lifecycle({
                favoriteId: state.favorite._id,
                expectedUpdatedAt: state.favorite.updatedAt,
                deleted: state.isFavorite,
              });
            else await create({ workspaceId, target, parentId: null, name: null });
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <Star className="mr-1.5 size-4" fill={state.isFavorite ? "currentColor" : "none"} aria-hidden />
        {state.isFavorite ? "Remove favorite" : state.favorite ? "Restore favorite" : "Add favorite"}
      </Button>
      {state.blockedByFolder && <p className="text-12 text-secondary">Restore its removed favorite folder first.</p>}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
