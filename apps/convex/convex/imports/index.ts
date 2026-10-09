import { compareValues, ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireProjectForUser, requireUser, requireWorkspace } from "../identity/access";
import { requireAccountUser } from "../identity/session";
import { credentialMetadataAccess, audit } from "../mcp/access";
import { decrypt } from "../mcp/crypto";
import { pageBudget } from "../commercial/validation";
import { createTask } from "../tasks/create";
import { initialProperties, parseTaskText, validateProperties } from "../tasks/properties";
import {
  githubFailure,
  githubRetryAt,
  githubIssues,
  githubRepository,
  importRequest,
  importSelection,
  importRequestId,
  repositoryOwner,
  repositoryName,
} from "./schema";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { projectReader } from "../savedViews/scope";

async function access(
  ctx: QueryCtx,
  selection: Pick<Doc<"workspaceImports">, "projectId" | "credentialId" | "openStateId" | "closedStateId">,
  user: Doc<"users">
) {
  const scope = await requireProjectForUser(ctx, selection.projectId, user, true);
  const credential = await ctx.db.get(selection.credentialId);
  if (
    !credential ||
    credential.provider !== "github" ||
    credential.workspaceId !== scope.workspace._id ||
    (credential.projectId !== null && credential.projectId !== scope.project._id) ||
    !(await credentialMetadataAccess(ctx, credential, user._id))?.canUse
  )
    throw new ConvexError("Choose an active GitHub credential you can use in this project.");
  const states = await Promise.all(
    [selection.openStateId, selection.closedStateId].map(async (stateId) => {
      const validated = await validateProperties(ctx, scope.project, { ...initialProperties, stateId });
      if (!validated.state) throw new ConvexError("Choose native states for open and closed GitHub issues.");
      return validated.state;
    })
  );
  if (["done", "cancelled"].includes(states[0].status) || !["done", "cancelled"].includes(states[1].status))
    throw new ConvexError("Map open issues to an open state and closed issues to a completed or cancelled state.");
  return { ...scope, credential, states: { open: states[0], closed: states[1] } };
}

async function github(path: string, secret: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Summon-GitHub-Import",
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ConvexError(
      githubFailure.parse({
        message: `GitHub returned HTTP ${response.status}. Check repository access before retrying.`,
        retryAt: githubRetryAt.parse({
          status: response.status,
          retryAfter: response.headers.get("retry-after"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
        }),
      })
    );
  }
  if (!response.body || !response.headers.get("content-type")?.includes("application/json"))
    throw new ConvexError("GitHub returned an invalid response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      // oxlint-disable-next-line no-await-in-loop
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 2 * 1024 * 1024) throw new ConvexError("GitHub response exceeds the import page limit.");
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  return { data, link: response.headers.get("link") };
}

export const authorize = internalQuery({
  args: importSelection,
  handler: async (ctx, args) => {
    const scope = await access(ctx, args, await requireUser(ctx));
    const secret = await ctx.db
      .query("mcpSecrets")
      .withIndex("by_credential", (q) => q.eq("credentialId", args.credentialId))
      .unique();
    if (!secret) throw new ConvexError("GitHub credential secret is unavailable.");
    return {
      owner: repositoryOwner.parse(args.owner),
      repository: repositoryName.parse(args.repository),
      secret,
      credentialRevision: scope.credential.revision,
    };
  },
});

export const preview = action({
  args: importSelection,
  handler: async (ctx, args) => {
    const authority = await ctx.runQuery(internal.imports.index.authorize, args);
    const remote = githubRepository.parse(
      (
        await github(
          `/repos/${encodeURIComponent(authority.owner)}/${encodeURIComponent(authority.repository)}`,
          await decrypt(authority.secret)
        )
      ).data
    );
    return {
      ...remote,
      scope:
        "Open and closed issues only; pull requests are excluded. Descriptions retain their Markdown text. Existing external identities, including Trash, are skipped; history reports duplicate and Trash counts. Labels, assignees, invitations, comments and ongoing sync are not imported.",
    };
  },
});

export const begin = internalMutation({
  args: { ...importRequest, credentialRevision: v.number() },
  handler: async (ctx, args) => {
    const requestId = importRequestId.parse(args.requestId);
    const scope = await access(ctx, args, await requireUser(ctx));
    if (scope.credential.revision !== args.credentialRevision)
      throw new ConvexError("GitHub credential changed. Preview again.");
    const existing = await ctx.db
      .query("workspaceImports")
      .withIndex("by_requester_request", (q) => q.eq("requesterId", scope.user._id).eq("requestId", requestId))
      .unique();
    if (existing) {
      if (
        compareValues(
          [
            existing.projectId,
            existing.credentialId,
            existing.repositoryId,
            existing.openStateId,
            existing.closedStateId,
          ],
          [args.projectId, args.credentialId, args.repositoryId, args.openStateId, args.closedStateId]
        ) !== 0
      )
        throw new ConvexError("This import request belongs to another selection.");
      return existing._id;
    }
    const { sync: _sync, includeComments: _comments, inviteUsers: _invite, ...selection } = args;
    const jobId = await ctx.db.insert("workspaceImports", {
      ...selection,
      requestId,
      workspaceId: scope.workspace._id,
      requesterId: scope.user._id,
      provider: "github",
      page: 1,
      attempt: 0,
      status: "queued",
      imported: 0,
      duplicates: 0,
      trashedDuplicates: 0,
      pullRequests: 0,
      failure: null,
      retryAt: null,
    });
    await audit(ctx, scope.credential, scope.user._id, "start_github_import");
    await ctx.scheduler.runAfter(0, internal.imports.index.run, { jobId });
    return jobId;
  },
});

export const start = action({
  args: importRequest,
  handler: async (ctx, args): Promise<Id<"workspaceImports">> => {
    const requestId = importRequestId.parse(args.requestId);
    const {
      requestId: _request,
      repositoryId: _repository,
      sync: _sync,
      includeComments: _comments,
      inviteUsers: _invite,
      ...selection
    } = args;
    const authority = await ctx.runQuery(internal.imports.index.authorize, selection);
    const remote = githubRepository.parse(
      (
        await github(
          `/repos/${encodeURIComponent(authority.owner)}/${encodeURIComponent(authority.repository)}`,
          await decrypt(authority.secret)
        )
      ).data
    );
    if (remote.id !== args.repositoryId)
      throw new ConvexError("GitHub repository identity changed. Preview the repository again.");
    return ctx.runMutation(internal.imports.index.begin, {
      ...args,
      requestId,
      owner: remote.owner.login,
      repository: remote.name,
      repositoryId: remote.id,
      credentialRevision: authority.credentialRevision,
    });
  },
});

export const claim = internalMutation({
  args: { jobId: v.id("workspaceImports") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "queued") return null;
    try {
      const scope = await access(ctx, job, await requireAccountUser(ctx, job.requesterId));
      if (scope.credential.revision !== job.credentialRevision)
        throw new ConvexError("GitHub credential changed. Start a new import.");
      const secret = await ctx.db
        .query("mcpSecrets")
        .withIndex("by_credential", (q) => q.eq("credentialId", job.credentialId))
        .unique();
      if (!secret) throw new ConvexError("GitHub credential secret is unavailable.");
      const attempt = job.attempt + 1;
      await ctx.db.patch(jobId, { status: "processing", attempt, failure: null, retryAt: null });
      await ctx.scheduler.runAfter(45000, internal.imports.index.fail, {
        jobId,
        attempt,
        failure: "Import processing timed out. Retry this page.",
        retryAt: null,
      });
      return {
        owner: job.owner,
        repository: job.repository,
        repositoryId: job.repositoryId,
        page: job.page,
        attempt,
        secret,
      };
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await ctx.db.patch(jobId, {
        status: "failed",
        failure: "Import access or state selection changed. Restore access before retrying.",
        retryAt: null,
      });
      return null;
    }
  },
});

export const commitPage = internalMutation({
  args: { jobId: v.id("workspaceImports"), attempt: v.number(), pageJson: v.string(), hasNext: v.boolean() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status !== "processing" || job.attempt !== args.attempt) return;
    const scope = await access(ctx, job, await requireAccountUser(ctx, job.requesterId));
    if (scope.credential.revision !== job.credentialRevision)
      throw new ConvexError("GitHub credential changed. Start a new import.");
    const raw: unknown = JSON.parse(args.pageJson);
    const issues = githubIssues.parse(raw);
    let imported = 0,
      duplicates = 0,
      trashedDuplicates = 0,
      pullRequests = 0;
    for (const issue of issues) {
      if (issue.pull_request) {
        pullRequests++;
        continue;
      }
      // Missing deletedAt constraint intentionally includes Trash: retries never resurrect imported identity.
      // oxlint-disable-next-line no-await-in-loop
      const prior = await ctx.db
        .query("tasks")
        .withIndex("by_project_external", (q) =>
          q.eq("projectId", job.projectId).eq("externalSource", `github:${job.repositoryId}`).eq("externalId", issue.id)
        )
        .first();
      if (prior) {
        duplicates++;
        trashedDuplicates += Number(prior.deletedAt !== null);
        continue;
      }
      const state = scope.states[issue.state];
      // oxlint-disable-next-line no-await-in-loop
      const { project } = await requireProjectForUser(ctx, job.projectId, scope.user, true);
      // Each Task writer owns and advances the actual current Project sequence.
      // oxlint-disable-next-line no-await-in-loop
      await createTask(ctx, project, scope.user._id, {
        ...initialProperties,
        ...parseTaskText(issue.title, issue.body),
        stateId: state._id,
        status: state.status,
        externalSource: `github:${job.repositoryId}`,
        externalId: issue.id,
      });
      imported++;
    }
    await ctx.db.patch(job._id, {
      page: job.page + 1,
      status: args.hasNext ? "queued" : "completed",
      imported: job.imported + imported,
      duplicates: job.duplicates + duplicates,
      trashedDuplicates: job.trashedDuplicates + trashedDuplicates,
      pullRequests: job.pullRequests + pullRequests,
    });
    if (args.hasNext) await ctx.scheduler.runAfter(0, internal.imports.index.run, { jobId: job._id });
  },
});

export const fail = internalMutation({
  args: {
    jobId: v.id("workspaceImports"),
    attempt: v.number(),
    failure: v.string(),
    retryAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status === "processing" && job.attempt === args.attempt)
      await ctx.db.patch(job._id, { status: "failed", failure: args.failure, retryAt: args.retryAt });
  },
});

export const run = internalAction({
  args: { jobId: v.id("workspaceImports") },
  handler: async (ctx, args): Promise<void> => {
    const claimed = await ctx.runMutation(internal.imports.index.claim, args);
    if (!claimed) return;
    try {
      const secret = await decrypt(claimed.secret);
      const path = `/repos/${encodeURIComponent(claimed.owner)}/${encodeURIComponent(claimed.repository)}`;
      const repository = githubRepository.parse((await github(path, secret)).data);
      if (repository.id !== claimed.repositoryId)
        throw new ConvexError({
          message: "The selected GitHub repository identity changed. Start a new import.",
          retryAt: null,
        });
      const response = await github(
        `${path}/issues?state=all&sort=created&direction=asc&per_page=20&page=${claimed.page}`,
        secret
      );
      const next = response.link?.match(/<([^>]+)>;\s*rel="next"/);
      if (next) {
        const url = new URL(next[1]);
        if (url.origin !== "https://api.github.com" || Number(url.searchParams.get("page")) !== claimed.page + 1)
          throw new ConvexError("GitHub returned invalid pagination.");
      }
      await ctx.runMutation(internal.imports.index.commitPage, {
        ...args,
        attempt: claimed.attempt,
        pageJson: JSON.stringify(response.data),
        hasNext: Boolean(next),
      });
    } catch (error) {
      const providerFailure = githubFailure.safeParse(error instanceof ConvexError ? error.data : null);
      const failure = providerFailure.success
        ? providerFailure.data
        : {
            message: "GitHub import failed. Check repository access, states and credential before retrying.",
            retryAt: null,
          };
      await ctx.runMutation(internal.imports.index.fail, {
        ...args,
        attempt: claimed.attempt,
        failure: failure.message,
        retryAt: failure.retryAt,
      });
      throw error;
    }
  },
});

export const retry = mutation({
  args: { jobId: v.id("workspaceImports") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    const user = await requireUser(ctx);
    if (!job || job.requesterId !== user._id) throw new ConvexError("Import not found.");
    const scope = await access(ctx, job, user);
    if (scope.credential.revision !== job.credentialRevision)
      throw new ConvexError("GitHub credential changed. Start a new import.");
    if (job.status !== "failed" || (job.retryAt !== null && job.retryAt > Date.now()))
      throw new ConvexError("This import is not ready to retry.");
    await ctx.db.patch(jobId, { status: "queued", failure: null, retryAt: null });
    await ctx.scheduler.runAfter(0, internal.imports.index.run, { jobId });
  },
});

export const history = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { member, user } = await requireWorkspace(ctx, args.workspaceId);
    if (member.role === "guest") throw new ConvexError("Guests cannot view import history.");
    const read = projectReader(ctx, args.workspaceId, user._id);
    return stream(ctx.db, schema)
      .query("workspaceImports")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (job) => {
        if (!(job.requesterId === user._id || member.role === "admin")) return null;
        const projectAccess = await read(job.projectId);
        if (!projectAccess) return null;
        let canRetry = false;
        if (job.requesterId === user._id && job.status === "failed") {
          try {
            const current = await access(ctx, job, user);
            canRetry = current.credential.revision === job.credentialRevision;
          } catch (error) {
            if (!(error instanceof ConvexError)) throw error;
          }
        }
        return Object.assign(job, {
          canRetry,
          projectName: projectAccess.project.name,
          projectIdentifier: projectAccess.project.identifier,
        });
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
