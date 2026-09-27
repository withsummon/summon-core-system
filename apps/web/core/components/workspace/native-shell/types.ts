import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
export type NativeWorkspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
export type NativeProfile = FunctionReturnType<typeof api.identity.profile.get>;
