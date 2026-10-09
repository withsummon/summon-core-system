import { v, type Infer } from "convex/values";
// Matches the inherited persisted API values: secret/private 0, workspace-public 2.
export const projectNetwork = v.union(v.literal(0), v.literal(2));
export type ProjectNetwork = Infer<typeof projectNetwork>;
