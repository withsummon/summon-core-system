// Workspace switches use the same clean workspace-default params as core navigation.
export function completionRoute(current: URLSearchParams, selectedSlug: string, authorizedSlug: string) {
  const requested = current.get("workspace");
  const next =
    requested === selectedSlug || requested === authorizedSlug ? new URLSearchParams(current) : new URLSearchParams();
  next.set("workspace", authorizedSlug);
  return next;
}
