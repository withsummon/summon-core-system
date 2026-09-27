import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { getAllDocumentFormatsFromDocumentEditorBinaryData } from "@plane/editor/lib";
const page = { numItems: 30, cursor: null };
const template = {
  name: "Project brief",
  type: "brief",
  description: "Brief",
  contentTemplate: "Write a project brief using only facts in context.",
  variables: ["scope"],
  isActive: true,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function setup() {
  const base = await workspaceJourney();
  const templateId = await base.owner.mutation(api.automation.templates.save, {
    workspaceId: base.workspaceId,
    ...template,
  });
  const args = {
    templateId,
    expectedTemplateRevision: 0,
    projectId: base.projectId,
    requestId: "request-0001",
    title: "Delivery brief",
    input: { scope: "Synthetic scope" },
    context: { projectId: base.projectId, clientId: null, meetingId: null, documentIds: [] },
  };
  return { ...base, templateId, args };
}
function provider(markdown: string) {
  vi.stubEnv("LLM_API_KEY", "synthetic-test-key");
  vi.stubEnv("LLM_PROVIDER", "openai");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          "data: " +
            JSON.stringify({ choices: [{ delta: { content: markdown }, finish_reason: null }] }) +
            '\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
        )
    )
  );
}
test("template defaults install once and do not overwrite workspace customizations", async () => {
  const { owner, workspaceId } = await setup();
  const first = await owner.mutation(api.automation.templates.installDefaults, { workspaceId });
  expect(first.created).toBeGreaterThan(0);
  expect(await owner.mutation(api.automation.templates.installDefaults, { workspaceId })).toEqual({ created: 0 });
  const rows = await owner.query(api.automation.templates.list, { workspaceId, paginationOpts: page });
  const seeded = rows.page.find((item) => item.systemKey);
  if (!seeded) throw new Error("Missing fixture default");
  await owner.mutation(api.automation.templates.save, {
    workspaceId,
    templateId: seeded._id,
    expectedRevision: seeded.revision,
    ...template,
    name: seeded.name,
    contentTemplate: "Customized instructions",
  });
  await owner.mutation(api.automation.templates.installDefaults, { workspaceId });
  expect((await owner.query(api.automation.templates.get, { templateId: seeded._id })).contentTemplate).toBe(
    "Customized instructions"
  );
});
test("template naming and revisions reject duplicate or stale full saves", async () => {
  const { owner, workspaceId, templateId } = await setup();
  await expect(owner.mutation(api.automation.templates.save, { workspaceId, ...template })).rejects.toThrow(
    "already exists"
  );
  await owner.mutation(api.automation.templates.save, {
    workspaceId,
    templateId,
    expectedRevision: 0,
    ...template,
    description: "Changed",
  });
  await expect(
    owner.mutation(api.automation.templates.save, { workspaceId, templateId, expectedRevision: 0, ...template })
  ).rejects.toThrow("Template changed");
});
test("missing provider stores failed job without fabricated preview or document", async () => {
  const { t, owner, args } = await setup();
  vi.stubEnv("LLM_API_KEY", "");
  const jobId = await owner.action(api.automation.generate.preview, args);
  expect(await owner.query(api.automation.jobs.get, { jobId })).toMatchObject({
    status: "failed",
    error: "provider_unconfigured",
    previewMarkdown: "",
    publishedDocumentId: null,
  });
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(0);
  await expect(owner.action(api.automation.publish.document, { jobId })).rejects.toThrow("Only a completed preview");
});
test("real provider adapter stores preview only; explicit publication atomically creates a coherent editable document once", async () => {
  const { t, owner, args } = await setup();
  provider("# Preview\n\n<script>untrusted()</script>\nConfirmed facts only.");
  const jobId = await owner.action(api.automation.generate.preview, args);
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(0);
  expect(await owner.action(api.automation.generate.preview, args)).toBe(jobId);
  expect(fetch).toHaveBeenCalledTimes(1);
  const documentId = await owner.action(api.automation.publish.document, { jobId });
  expect(await owner.action(api.automation.publish.document, { jobId })).toBe(documentId);
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(1);
  const snapshot = await owner.query(api.documents.index.snapshot, { documentId });
  if (!snapshot) throw new Error("Missing publication snapshot");
  const decoded = getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(snapshot.descriptionBinary), false);
  expect(decoded.contentJSON).toEqual(snapshot.descriptionJson);
  expect(decoded.contentHTML).toBe(snapshot.descriptionHtml);
  expect(snapshot.descriptionHtml).not.toContain("<script>");
  expect(snapshot.descriptionHtml).toContain("&lt;script&gt;");
  expect(await t.run((ctx) => ctx.db.get(documentId))).toMatchObject({
    projectIds: [args.projectId],
    viewProps: {
      summon_document: {
        kind: "summon_automation",
        markdown: "# Preview\n\n<script>untrusted()</script>\nConfirmed facts only.",
        provider: "openai",
      },
    },
  });
  expect(await owner.query(api.automation.jobs.get, { jobId })).toMatchObject({
    publishedDocumentId: documentId,
    status: "completed",
  });
});
test("a snapshot failure rolls back document creation and publication link in the same transaction", async () => {
  const { t, owner, args } = await setup();
  const { jobId } = await owner.mutation(internal.automation.jobs.begin, args);
  await owner.mutation(internal.automation.jobs.complete, {
    jobId,
    markdown: "Preview",
    provider: "test",
    model: "test",
  });
  await expect(
    owner.mutation(internal.automation.publication.commit, {
      jobId,
      expectedPreview: "Preview",
      descriptionBinary: new ArrayBuffer(0),
      descriptionHtml: "<p>Preview</p>",
      descriptionJson: { type: "doc" },
    })
  ).rejects.toThrow("snapshot exceeds");
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(0);
  expect((await owner.query(api.automation.jobs.get, { jobId })).publishedDocumentId).toBeNull();
});
test("post-provider project revocation prevents generated preview persistence", async () => {
  const { t, owner, args, userId, projectId } = await setup();
  vi.stubEnv("LLM_API_KEY", "synthetic-key");
  vi.stubEnv("LLM_PROVIDER", "openai");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await t.run(async (ctx) => {
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
          .unique();
        if (member) await ctx.db.patch(member._id, { active: false });
      });
      return new Response(
        'data: {"choices":[{"delta":{"content":"Withhold this"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
      );
    })
  );
  const jobId = await owner.action(api.automation.generate.preview, args);
  expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({
    status: "failed",
    previewMarkdown: "",
    error: "generation_failed",
  });
});
test("other workspace members cannot publish a requester's private preview", async () => {
  const { t, owner, args, workspaceId, projectId } = await setup();
  provider("Preview");
  const jobId = await owner.action(api.automation.generate.preview, args);
  const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Other member" }));
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: strangerId, role: "admin", active: true });
    await ctx.db.insert("projectMembers", { workspaceId, projectId, userId: strangerId, role: "admin", active: true });
  });
  const stranger = t.withIdentity({ subject: strangerId });
  await expect(stranger.query(api.automation.jobs.get, { jobId })).rejects.toThrow("access denied");
  await expect(stranger.action(api.automation.publish.document, { jobId })).rejects.toThrow("access denied");
});

test("revoked source candidates leave a usable cursor to later authorized jobs", async () => {
  const { t, owner, args, workspaceId, userId } = await setup();
  const { jobId: accessible } = await owner.mutation(internal.automation.jobs.begin, args);
  const { jobId: revoked } = await owner.mutation(internal.automation.jobs.begin, {
    ...args,
    requestId: "request-0002",
  });
  await t.run(async (ctx) => {
    const clientId = await ctx.db.insert("clients", {
      workspaceId,
      name: "Deleted source",
      companyName: "",
      email: "",
      phone: "",
      website: "",
      industry: "",
      status: "active",
      notes: "",
      ownerId: null,
      deleted: true,
      headOffice: "",
      relationshipStartedAt: null,
      externalId: null,
      externalSource: null,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(revoked, { context: { ...args.context, clientId } });
  });
  const first = await owner.query(api.automation.jobs.list, {
    workspaceId,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await owner.query(api.automation.jobs.list, {
    workspaceId,
    paginationOpts: { numItems: 1, cursor: first.continueCursor },
  });
  expect(next.page.map((job) => job._id)).toEqual([accessible]);
});

test("a changed template rejects unseen instructions while a completed request remains idempotent", async () => {
  const { owner, args, templateId, workspaceId } = await setup();
  const { jobId } = await owner.mutation(internal.automation.jobs.begin, args);
  await owner.mutation(api.automation.templates.save, {
    workspaceId,
    templateId,
    expectedRevision: 0,
    ...template,
    contentTemplate: "New instructions",
  });
  expect((await owner.mutation(internal.automation.jobs.begin, args)).jobId).toBe(jobId);
  await expect(
    owner.mutation(internal.automation.jobs.begin, { ...args, requestId: "request-changed" })
  ).rejects.toThrow("Template changed");
  expect((await owner.query(api.automation.jobs.get, { jobId })).template.contentTemplate).toBe(
    template.contentTemplate
  );
});
