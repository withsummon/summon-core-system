import { createContext } from "react";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
export type NativeWorkspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
export type NativeProfile = FunctionReturnType<typeof api.identity.profile.get>;

export type WorkspaceSession = {
  user: NativeProfile;
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
};

export const NativeTaskActionContext = createContext<((taskId: Id<"tasks">, kind: "edit" | "copy") => void) | null>(
  null
);
export const NativeProjectCreateContext = createContext<(() => void) | null>(null);
export const NativeTaskCreateContext = createContext<(() => void) | null>(null);
