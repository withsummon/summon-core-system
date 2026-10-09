import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex } from "convex-helpers/server/zod4";

export const repositoryName = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
export const repositoryOwner = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
export const importRequestId = z.uuid();
export const importSelection = {
  projectId: v.id("projects"),
  credentialId: v.id("mcpCredentials"),
  owner: zodToConvex(repositoryOwner),
  repository: zodToConvex(repositoryName),
  openStateId: v.id("taskStates"),
  closedStateId: v.id("taskStates"),
};
export const importRequest = {
  ...importSelection,
  repositoryId: v.string(),
  requestId: zodToConvex(importRequestId),
  sync: v.optional(v.literal(false)),
  includeComments: v.optional(v.literal(false)),
  inviteUsers: v.optional(v.literal(false)),
};
const remoteId = z.number().int().positive().safe().transform(String);
export const githubRepository = z.object({
  id: remoteId,
  name: repositoryName,
  owner: z.object({ login: repositoryOwner }),
});
export const githubIssues = z
  .array(
    z.object({
      id: remoteId,
      title: z.string(),
      body: z
        .string()
        .nullable()
        .transform((body) => body ?? ""),
      state: z.enum(["open", "closed"]),
      pull_request: z.object({ url: z.url() }).optional(),
    })
  )
  .max(20);
export const githubFailure = z.object({ message: z.string(), retryAt: z.number().int().safe().nullable() });
const headerSeconds = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .nonnegative()
      .max(Math.floor(Number.MAX_SAFE_INTEGER / 1000))
  );
export const githubRetryAt = z
  .object({
    status: z.number().int(),
    retryAfter: headerSeconds.nullable(),
    remaining: z.string().nullable(),
    reset: headerSeconds.nullable(),
  })
  .transform(({ status, retryAfter, remaining, reset }) => {
    if (retryAfter !== null) return Date.now() + retryAfter * 1000;
    if (remaining === "0" && reset !== null) return reset * 1000;
    return [403, 429].includes(status) ? Date.now() + 60000 : null;
  });
export const importTables = {
  workspaceImports: defineTable({
    ...importSelection,
    workspaceId: v.id("workspaces"),
    requesterId: v.id("users"),
    requestId: v.string(),
    provider: v.literal("github"),
    repositoryId: v.string(),
    credentialRevision: v.number(),
    page: v.number(),
    attempt: v.number(),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    imported: v.number(),
    duplicates: v.number(),
    trashedDuplicates: v.number(),
    pullRequests: v.number(),
    failure: v.union(v.string(), v.null()),
    retryAt: v.union(v.number(), v.null()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_requester_request", ["requesterId", "requestId"]),
};
