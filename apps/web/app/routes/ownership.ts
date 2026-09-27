// Build-time ownership is explicit. It never changes after an auth/query failure.
export function stickiesRouteOwner(value: string | undefined): "legacy" | "convex" {
  if (value === undefined || value === "legacy") return "legacy";
  if (value === "convex") return "convex";
  throw new Error("SUMMON_STICKIES_ROUTE_OWNER must be legacy or convex.");
}
export const nativeStickiesRoute = stickiesRouteOwner(process.env.SUMMON_STICKIES_ROUTE_OWNER) === "convex";
