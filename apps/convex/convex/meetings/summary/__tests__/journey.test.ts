import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
import { applyUpdates, getAllDocumentFormatsFromDocumentEditorBinaryData } from "@plane/editor/lib";
import { parseMom } from "../mom";
const result = {
  summary: "Discussed delivery scope.",
  decisions: ["Keep the scope small"],
  action_suggestions: [{ title: "Review scope", details: "Suggestion only" }],
  discussion_topics: [{ topic: "Scope", details: ["Small delivery"] }],
  todos_by_party: [{ party: "Summon", items: [{ task: "Review scope", notes: "" }] }],
  open_items: ["Timing undecided"],
  next_actions: [{ action: "Review scope", owner: "", due_date: "" }],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function setup(save = true) {
  const base = await workspaceJourney();
  const meetingId = await base.owner.mutation(api.meetings.index.save, {
    workspaceId: base.workspaceId,
    participantIds: [base.userId],
    data: {
      title: "Weekly review",
      agenda: "Scope",
      notes: "",
      location: "Jakarta",
      meetingUrl: "",
      status: "scheduled",
      startsAt: Date.UTC(2026, 8, 27, 10),
      endsAt: null,
      projectId: base.projectId,
      summaryDocumentId: null,
    },
  });
  const ids = { workspaceId: base.workspaceId, meetingId };
  const initial = await base.owner.query(api.meetings.summary.transcripts.get, ids);
  const saveArgs = {
    ...ids,
    expectedMeetingUpdatedAt: initial.meetingUpdatedAt,
    expectedTranscriptRevision: initial.transcriptRevision,
    expectedDocumentRevision: initial.documentRevision,
    expectedDocumentUpdatedAt: initial.documentUpdatedAt,
    transcript: "Keep the scope small. Timing remains undecided.",
    language: "en",
  };
  if (save) await base.owner.action(api.meetings.summary.transcriptActions.save, saveArgs);
  const source = await base.owner.query(api.meetings.summary.transcripts.get, ids);
  const args = {
    ...ids,
    requestId: "summary-request-1",
    expectedMeetingUpdatedAt: source.meetingUpdatedAt,
    expectedTranscriptRevision: source.transcriptRevision ?? 0,
    expectedDocumentRevision: source.documentRevision ?? 0,
    expectedDocumentUpdatedAt: source.documentUpdatedAt ?? 0,
    context: { projectId: base.projectId, clientId: null, meetingId: null, documentIds: [] },
  };
  return { ...base, ...ids, source, args, saveArgs };
}
function provider(value = JSON.stringify(result), before?: () => Promise<void>) {
  vi.stubEnv("LLM_API_KEY", "synthetic-key");
  vi.stubEnv("LLM_PROVIDER", "openai");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await before?.();
      return new Response(
        "data: " +
          JSON.stringify({ choices: [{ delta: { content: value }, finish_reason: "stop" }] }) +
          "\n\ndata: [DONE]\n\n"
      );
    })
  );
}
test("text source creates one private canonical document and stale transcript saves cannot overwrite it", async () => {
  const { owner, t, source, saveArgs, meetingId } = await setup();
  expect(await t.run((ctx) => ctx.db.get(source.documentId!))).toMatchObject({
    access: "private",
    viewProps: { summon_transcript_meeting_id: meetingId, summon_document: { source_transcript: saveArgs.transcript } },
  });
  await expect(
    owner.action(api.meetings.summary.transcriptActions.save, { ...saveArgs, transcript: "stale replacement" })
  ).rejects.toThrow("changed");
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(1);
});
test("missing provider leaves original transcript intact and records a genuine failed run", async () => {
  const { owner, t, args, source } = await setup();
  vi.stubEnv("LLM_API_KEY", "");
  const runId = await owner.action(api.meetings.summary.generate.summarize, args);
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    status: "failed",
    error: "provider_unconfigured",
    result: null,
  });
  expect((await t.run((ctx) => ctx.db.get(source.documentId!)))?.revision).toBe(source.documentRevision);
});
test("structured summary preserves source and canonical binary, creates no tasks, and request retry is idempotent", async () => {
  const { owner, t, args, source, saveArgs } = await setup();
  provider();
  const runId = await owner.action(api.meetings.summary.generate.summarize, args);
  expect(await owner.action(api.meetings.summary.generate.summarize, args)).toBe(runId);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    status: "completed",
    result,
    documentId: source.documentId,
  });
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("tasks").collect())).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("meetingTasks").collect())).toHaveLength(0);
  const doc = await t.run((ctx) => ctx.db.get(source.documentId!));
  expect(doc).toMatchObject({
    access: "private",
    viewProps: { summon_document: { kind: "summon_mom", source_transcript: saveArgs.transcript, ...result } },
  });
  const snapshot = await owner.query(api.documents.index.snapshot, { documentId: source.documentId! });
  if (!snapshot) throw new Error("Missing snapshot");
  const decoded = getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(snapshot.descriptionBinary), true);
  expect(decoded.titleHTML).toBe(doc?.name);
  expect(decoded.titleHTML).toBe("Weekly review MoM");
  expect(decoded.contentJSON).toEqual(snapshot.descriptionJson);
  expect(decoded.contentHTML).toBe(snapshot.descriptionHtml);
  expect(snapshot.descriptionHtml).toContain("NEXT ACTIONS");
  expect(snapshot.descriptionHtml).toContain("Tidak tercantum");
});
test("invalid structured provider output never overwrites transcript", async () => {
  const { owner, t, args, source } = await setup();
  provider('{"summary":"Invented partial response"}');
  const runId = await owner.action(api.meetings.summary.generate.summarize, args);
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", error: "generation_failed" });
  expect((await t.run((ctx) => ctx.db.get(source.documentId!)))?.revision).toBe(source.documentRevision);
  expect(() => parseMom(JSON.stringify({ ...result, tool_call: { name: "create_task" } }))).toThrow("fields");
});
test("one in-flight summary per meeting is enforced and explicit cancellation permits a new request", async () => {
  const { owner, args } = await setup();
  const { runId } = await owner.mutation(internal.meetings.summary.runs.begin, args);
  expect((await owner.mutation(internal.meetings.summary.runs.begin, args)).runId).toBe(runId);
  await expect(
    owner.mutation(internal.meetings.summary.runs.begin, { ...args, requestId: "summary-request-2" })
  ).rejects.toThrow("already running");
  await owner.mutation(api.meetings.summary.runs.cancel, { runId });
  expect(
    (await owner.mutation(internal.meetings.summary.runs.begin, { ...args, requestId: "summary-request-2" })).generate
  ).toBe(true);
});
test("post-provider project revocation prevents summary persistence", async () => {
  const { owner, t, args, projectId, userId, source } = await setup();
  provider(JSON.stringify(result), () =>
    t.run(async (ctx) => {
      const membership = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      if (membership) await ctx.db.patch(membership._id, { active: false });
    })
  );
  const runId = await owner.action(api.meetings.summary.generate.summarize, args);
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", result: null });
  expect((await t.run((ctx) => ctx.db.get(source.documentId!)))?.revision).toBe(source.documentRevision);
});
test("a concurrent document edit wins over a late provider reply", async () => {
  const { owner, t, args, source } = await setup();
  provider(JSON.stringify(result), async () => {
    const snapshot = await owner.query(api.documents.index.snapshot, { documentId: source.documentId! });
    if (!snapshot) throw new Error("Missing snapshot");
    await owner.mutation(api.documents.index.saveSnapshot, {
      documentId: source.documentId!,
      expectedRevision: source.documentRevision!,
      descriptionBinary: snapshot.descriptionBinary,
      descriptionHtml: snapshot.descriptionHtml,
      descriptionJson: snapshot.descriptionJson,
      name: "Human edit",
    });
  });
  const runId = await owner.action(api.meetings.summary.generate.summarize, args);
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", result: null });
  expect(await t.run((ctx) => ctx.db.get(source.documentId!))).toMatchObject({
    name: "Human edit",
    revision: source.documentRevision! + 1,
  });
});
test("another project administrator cannot read or summarize an owner's private transcript", async () => {
  const { t, args, workspaceId, projectId, meetingId } = await setup();
  const strangerId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Other admin" });
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: id, role: "admin", active: true });
    await ctx.db.insert("projectMembers", { workspaceId, projectId, userId: id, role: "admin", active: true });
    return id;
  });
  const stranger = t.withIdentity({ subject: strangerId });
  await expect(stranger.query(api.meetings.summary.transcripts.get, { workspaceId, meetingId })).rejects.toThrow(
    "access denied"
  );
  await expect(stranger.action(api.meetings.summary.generate.summarize, args)).rejects.toThrow("access denied");
});
test("invalid canonical snapshot rolls back transcript document and meeting link", async () => {
  const { t, owner, saveArgs, meetingId } = await setup(false);
  await expect(
    owner.mutation(internal.meetings.summary.transcripts.commit, {
      ...saveArgs,
      descriptionBinary: new ArrayBuffer(0),
      descriptionHtml: "",
      descriptionJson: {},
    })
  ).rejects.toThrow("snapshot exceeds");
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("meetingTranscripts").collect())).toHaveLength(0);
  expect((await t.run((ctx) => ctx.db.get(meetingId)))?.summaryDocumentId).toBeNull();
});

test("regeneration updates the same canonical document and retains the original text source", async () => {
  const { owner, t, args, source, workspaceId, meetingId } = await setup();
  provider();
  await owner.action(api.meetings.summary.generate.summarize, args);
  const current = await owner.query(api.meetings.summary.transcripts.get, { workspaceId, meetingId });
  const runId = await owner.action(api.meetings.summary.generate.summarize, {
    ...args,
    requestId: "summary-request-2",
    expectedMeetingUpdatedAt: current.meetingUpdatedAt,
    expectedTranscriptRevision: current.transcriptRevision!,
    expectedDocumentRevision: current.documentRevision!,
    expectedDocumentUpdatedAt: current.documentUpdatedAt!,
  });
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "completed", documentId: source.documentId });
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(1);
  expect((await owner.query(api.meetings.summary.transcripts.get, { workspaceId, meetingId })).transcript).toBe(
    source.transcript
  );
});
test("cancellation during provider work prevents a late result from changing the canonical document", async () => {
  const { owner, t, args, source } = await setup();
  provider(JSON.stringify(result), async () => {
    const run = await owner.query(api.meetings.summary.runs.latest, {
      workspaceId: args.workspaceId,
      meetingId: args.meetingId,
    });
    if (!run) throw new Error("Missing active run");
    await owner.mutation(api.meetings.summary.runs.cancel, { runId: run._id });
  });
  const runId = await owner.action(api.meetings.summary.generate.summarize, args);
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", error: "cancelled", result: null });
  expect((await t.run((ctx) => ctx.db.get(source.documentId!)))?.revision).toBe(source.documentRevision);
});

test("a stale meeting form cannot detach a newly saved transcript document", async () => {
  const { owner, t, saveArgs, meetingId, workspaceId, projectId } = await setup(false);
  const documentId = await owner.action(api.meetings.summary.transcriptActions.save, saveArgs);
  await expect(
    owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      expectedUpdatedAt: saveArgs.expectedMeetingUpdatedAt,
      participantIds: [],
      data: {
        title: "Old draft",
        agenda: "",
        notes: "",
        location: "",
        meetingUrl: "",
        status: "scheduled",
        startsAt: Date.now(),
        endsAt: null,
        projectId,
        summaryDocumentId: null,
      },
    })
  ).rejects.toThrow("Meeting changed");
  expect((await t.run((ctx) => ctx.db.get(meetingId)))?.summaryDocumentId).toBe(documentId);
});

test("a shared canonical document cannot receive private-context summaries or source replacements", async () => {
  const { owner, t, args, source, workspaceId, meetingId } = await setup();
  await t.run((ctx) => ctx.db.patch(source.documentId!, { access: "public" }));
  expect(await owner.query(api.meetings.summary.transcripts.get, { workspaceId, meetingId })).toMatchObject({
    canReplaceSource: false,
    canSummarize: false,
  });
  await expect(owner.action(api.meetings.summary.generate.summarize, args)).rejects.toThrow("must be private");
  await expect(
    owner.action(api.meetings.summary.transcriptActions.save, {
      workspaceId,
      meetingId,
      expectedMeetingUpdatedAt: source.meetingUpdatedAt,
      expectedTranscriptRevision: source.transcriptRevision,
      expectedDocumentRevision: source.documentRevision,
      expectedDocumentUpdatedAt: source.documentUpdatedAt,
      transcript: "New private source",
      language: "en",
    })
  ).rejects.toThrow("must be private");
  expect((await t.run((ctx) => ctx.db.get(source.documentId!)))?.revision).toBe(source.documentRevision);
});
test("oversized transcript and language reject at action validation before conversion or persistence", async () => {
  const { owner, t, saveArgs } = await setup(false);
  await expect(
    owner.action(api.meetings.summary.transcriptActions.save, { ...saveArgs, transcript: "x".repeat(120001) })
  ).rejects.toThrow("120,000");
  await expect(
    owner.action(api.meetings.summary.transcriptActions.save, { ...saveArgs, language: "x".repeat(101) })
  ).rejects.toThrow("valid language");
  expect(await t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(0);
});

test("current meeting edits cannot strand the canonical source by moving its project or document link", async () => {
  const { owner, t, source, workspaceId, meetingId, projectId } = await setup();
  const otherProject = await owner.mutation(api.projects.index.create, {
    workspaceId,
    name: "Other project",
    identifier: "OTHER",
  });
  const current = await owner.query(api.meetings.index.get, { workspaceId, meetingId });
  const data = {
    title: current.title,
    agenda: current.agenda,
    notes: current.notes,
    location: current.location,
    meetingUrl: current.meetingUrl,
    status: current.status,
    startsAt: current.startsAt,
    endsAt: current.endsAt,
    projectId,
    summaryDocumentId: source.documentId,
  };
  await expect(
    owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      expectedUpdatedAt: current.updatedAt,
      participantIds: [],
      data: { ...data, projectId: otherProject },
    })
  ).rejects.toThrow("must keep its canonical document and project");
  await expect(
    owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      expectedUpdatedAt: current.updatedAt,
      participantIds: [],
      data: { ...data, summaryDocumentId: null },
    })
  ).rejects.toThrow("must keep its canonical document and project");
  expect(await t.run((ctx) => ctx.db.get(meetingId))).toMatchObject({
    projectId,
    summaryDocumentId: source.documentId,
  });
  expect((await owner.query(api.meetings.summary.transcripts.get, { workspaceId, meetingId })).transcript).toBe(
    source.transcript
  );
});

test("a project collaborator can edit agenda while preserving a private transcript link without source access", async () => {
  const { t, owner, args, workspaceId, projectId, meetingId, source } = await setup();
  const collaboratorId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Collaborator" });
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: id, role: "member", active: true });
    await ctx.db.insert("projectMembers", { workspaceId, projectId, userId: id, role: "member", active: true });
    return id;
  });
  const collaborator = t.withIdentity({ subject: collaboratorId });
  const meeting = await collaborator.query(api.meetings.index.get, { workspaceId, meetingId });
  await collaborator.mutation(api.meetings.index.save, {
    workspaceId,
    meetingId,
    expectedUpdatedAt: meeting.updatedAt,
    participantIds: [],
    data: {
      title: meeting.title,
      agenda: "Revised shared agenda",
      notes: meeting.notes,
      location: meeting.location,
      meetingUrl: meeting.meetingUrl,
      status: meeting.status,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      projectId,
      summaryDocumentId: meeting.summaryDocumentId,
    },
  });
  expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({
    agenda: "Revised shared agenda",
    summaryDocumentId: source.documentId,
  });
  await expect(collaborator.query(api.meetings.summary.transcripts.get, { workspaceId, meetingId })).rejects.toThrow(
    "access denied"
  );
  await expect(collaborator.action(api.meetings.summary.generate.summarize, args)).rejects.toThrow("access denied");
});

test("transcript replacement carries CRDT deletions and its title to an already-open editor", async () => {
  const { owner, t, source, workspaceId, meetingId } = await setup();
  const documentId = source.documentId!;
  const before = await owner.query(api.documents.index.snapshot, { documentId });
  if (!before) throw new Error("Missing initial snapshot");
  const initial = getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(before.descriptionBinary), true);
  expect(initial.titleHTML).toBe("Weekly review transcript");
  await owner.action(api.meetings.summary.transcriptActions.save, {
    workspaceId,
    meetingId,
    expectedMeetingUpdatedAt: source.meetingUpdatedAt,
    expectedTranscriptRevision: source.transcriptRevision,
    expectedDocumentRevision: source.documentRevision,
    expectedDocumentUpdatedAt: source.documentUpdatedAt,
    transcript: "Entirely new transcript body.",
    language: "en",
  });
  const after = await owner.query(api.documents.index.snapshot, { documentId });
  if (!after) throw new Error("Missing replacement snapshot");
  const reopened = getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(after.descriptionBinary), true);
  const merged = getAllDocumentFormatsFromDocumentEditorBinaryData(
    applyUpdates(new Uint8Array(before.descriptionBinary), new Uint8Array(after.descriptionBinary)),
    true
  );
  expect(merged).toMatchObject({
    contentHTML: reopened.contentHTML,
    contentJSON: reopened.contentJSON,
    titleHTML: reopened.titleHTML,
  });
  expect(merged.contentHTML).toContain("Entirely new transcript body.");
  expect(merged.contentHTML).not.toContain("Timing remains undecided");
  expect(merged.titleHTML).toBe((await t.run((ctx) => ctx.db.get(documentId)))?.name);
});
test("generated minutes replace an open transcript CRDT instead of concatenating old and new body or titles", async () => {
  const { owner, t, args, source } = await setup();
  const documentId = source.documentId!;
  const before = await owner.query(api.documents.index.snapshot, { documentId });
  if (!before) throw new Error("Missing transcript snapshot");
  provider();
  await owner.action(api.meetings.summary.generate.summarize, args);
  const after = await owner.query(api.documents.index.snapshot, { documentId });
  if (!after) throw new Error("Missing minutes snapshot");
  const merged = getAllDocumentFormatsFromDocumentEditorBinaryData(
    applyUpdates(new Uint8Array(before.descriptionBinary), new Uint8Array(after.descriptionBinary)),
    true
  );
  expect(merged.contentHTML).toBe(after.descriptionHtml);
  expect(merged.contentJSON).toEqual(after.descriptionJson);
  expect(merged.contentHTML).not.toContain("Timing remains undecided.");
  expect(merged.titleHTML).toBe("Weekly review MoM");
  expect(merged.titleHTML).toBe((await t.run((ctx) => ctx.db.get(documentId)))?.name);
});
