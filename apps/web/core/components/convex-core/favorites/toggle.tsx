import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { Star } from "lucide-react";
import { mutationMessage } from "../commercial/forms";
type Target = FunctionArgs<typeof api.favorites.index.state>["target"];
export function FavoriteToggle({
  workspaceId,
  target,
  render,
}: {
  workspaceId: Id<"workspaces">;
  target: Target;
  render?: (
    state: FunctionReturnType<typeof api.favorites.index.state>,
    toggle: () => Promise<void>,
    pending: boolean
  ) => ReactNode;
}) {
  const access = useQuery(api.favorites.index.access, { workspaceId });
  const enabled = access?.canManage && (target.type !== "view" || access.canManageViews);
  const state = useQuery(api.favorites.index.state, enabled ? { workspaceId, target } : "skip");
  const create = useMutation(api.favorites.index.create),
    lifecycle = useMutation(api.favorites.index.lifecycle);
  const [pending, setPending] = useState(false);
  if (!enabled || !state?.canFavorite) return null;
  const toggle = async () => {
    if (pending || state.blockedByFolder) return;
    setPending(true);
    try {
      if (state.favorite)
        await lifecycle({
          favoriteId: state.favorite._id,
          expectedUpdatedAt: state.favorite.updatedAt,
          deleted: state.isFavorite,
        });
      else await create({ workspaceId, target, parentId: null, name: null });
    } catch (failure) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Unable to update favorite", message: mutationMessage(failure) });
    } finally {
      setPending(false);
    }
  };
  if (render) return render(state, toggle, pending);
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        disabled={pending || state.blockedByFolder}
        aria-pressed={state.isFavorite}
        onClick={() => void toggle()}
      >
        <Star className="mr-1.5 size-4" fill={state.isFavorite ? "currentColor" : "none"} aria-hidden />
        {state.isFavorite ? "Remove favorite" : state.favorite ? "Restore favorite" : "Add favorite"}
      </Button>
      {state.blockedByFolder && <p className="text-12 text-secondary">Restore its removed favorite folder first.</p>}
    </div>
  );
}
