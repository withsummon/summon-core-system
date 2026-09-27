import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const properties = { assigneeIds: [], labelIds: [], startDate: null, targetDate: null, estimatePointId: null };
async function setup() {
  const f = await workspaceJourney();
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: false,
  });
  const memberId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Writer" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: memberId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: memberId, role: "member" });
  const member = await signedIn(f.t, memberId);
  return { ...f, memberId, member };
}
test("noncreator project writer edits rich intake properties with dual CAS while triage state and removal authority stay owned", async () => {
  const f = await setup();
  const taskId = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Rich",
    html: "<p>Text</p>",
    priority: "low",
    properties: { ...properties, assigneeIds: [f.memberId], startDate: "2026-09-01", targetDate: "2026-09-30" },
  });
  const before = await f.member.query(api.intakes.index.get, { taskId });
  expect(before).toMatchObject({ canEdit: true, canEditProperties: true, canRemove: false });
  const args = {
    taskId,
    expectedUpdatedAt: before.intake.updatedAt,
    expectedTaskUpdatedAt: before.task.updatedAt,
    title: "Edited by writer",
    html: "<p>New</p>",
    priority: "high" as const,
    properties: { ...properties, assigneeIds: [f.userId] },
  };
  await f.member.mutation(api.intakes.index.edit, args);
  const after = await f.owner.query(api.intakes.index.get, { taskId });
  expect(after.task).toMatchObject({
    sequence: before.task.sequence,
    status: "triage",
    stateId: before.task.stateId,
    assigneeIds: [f.userId],
    priority: "high",
    startDate: null,
    targetDate: null,
  });
  await expect(f.member.mutation(api.intakes.index.edit, args)).rejects.toThrow("changed");
  await expect(
    f.member.mutation(api.intakes.index.remove, {
      taskId,
      expectedUpdatedAt: after.intake.updatedAt,
      expectedTaskUpdatedAt: after.task.updatedAt,
    })
  ).rejects.toThrow();
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: f.memberId });
  await expect(
    f.member.mutation(api.intakes.index.edit, {
      ...args,
      expectedUpdatedAt: after.intake.updatedAt,
      expectedTaskUpdatedAt: after.task.updatedAt,
    })
  ).rejects.toThrow("access");
});
test("guest retains own text editing and initial priority but cannot assign properties or edit others", async () => {
  const f = await setup();
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: f.memberId, role: "guest" });
  await expect(
    f.member.mutation(api.intakes.index.submit, {
      projectId: f.projectId,
      title: "Forbidden",
      html: "",
      priority: "none",
      properties,
    })
  ).rejects.toThrow("Guests");
  const taskId = await f.member.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Own",
    html: "",
    priority: "high",
  });
  const row = await f.member.query(api.intakes.index.get, { taskId });
  expect(row).toMatchObject({ canEdit: true, canEditProperties: false });
  const args = {
    taskId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
    title: "Own text",
    html: "<p>Own description</p>",
  };
  await expect(f.member.mutation(api.intakes.index.edit, { ...args, properties })).rejects.toThrow("only the title");
  await expect(f.member.mutation(api.intakes.index.edit, { ...args, priority: "low" })).rejects.toThrow(
    "only the title"
  );
  await f.member.mutation(api.intakes.index.edit, args);
  const other = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Other",
    html: "",
    priority: "none",
  });
  await expect(f.member.query(api.intakes.index.get, { taskId: other })).rejects.toThrow("not found");
});
test("invalid dates and foreign property references roll back text, properties, history, events and admission", async () => {
  const f = await setup();
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    projectId,
    parentId: null,
    data: { name: "Foreign", color: "blue", description: "", sortOrder: 0 },
  });
  const systemId = await f.owner.mutation(api.estimates.index.create, {
    projectId,
    name: "Foreign estimates",
    description: "",
    type: "points",
    points: [{ key: 0, value: "3", description: "" }],
  });
  const estimatePointId = (await f.owner.query(api.estimates.index.get, { systemId })).points[0]._id;
  const outsider = await f.t.run((ctx) => ctx.db.insert("users", { name: "Other project only" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: outsider,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId, userId: outsider, role: "member" });
  const taskId = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Unchanged",
    html: "<p>Original</p>",
    priority: "none",
  });
  const before = await f.owner.query(api.intakes.index.get, { taskId });
  const historyBefore = await f.t.run((ctx) => ctx.db.query("taskDescriptionVersions").collect());
  const eventsBefore = await f.t.run((ctx) => ctx.db.query("taskEvents").collect());
  await Promise.all(
    [
      { labelIds: [labelId] },
      { assigneeIds: [outsider] },
      { estimatePointId },
      { startDate: "2026-10-01", targetDate: "2026-09-01" },
    ].map(async (patch) => {
      await expect(
        f.member.mutation(api.intakes.index.edit, {
          taskId,
          expectedUpdatedAt: before.intake.updatedAt,
          expectedTaskUpdatedAt: before.task.updatedAt,
          title: "Must rollback",
          html: "<p>Must rollback</p>",
          properties: { ...properties, ...patch },
        })
      ).rejects.toThrow();
    })
  );
  expect(await f.owner.query(api.intakes.index.get, { taskId })).toEqual(before);
  expect(await f.t.run((ctx) => ctx.db.query("taskDescriptionVersions").collect())).toEqual(historyBefore);
  expect(await f.t.run((ctx) => ctx.db.query("taskEvents").collect())).toEqual(eventsBefore);
});
test("intake content token survives own upload while description changes invalidate metadata and stale content", async () => {
  const f = await setup();
  const taskId = await f.member.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Images",
    html: "<p>Original</p>",
    priority: "none",
  });
  const metadata = await f.member.query(api.intakes.index.get, { taskId });
  const content = await f.member.query(api.intakes.description.get, { taskId });
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const { createHash } = await import("node:crypto");
  const intent = await f.member.mutation(api.assets.taskAttachments.prepare, {
    taskId,
    name: "intake.png",
    contentType: "image/png",
    size: png.length,
    sha256: createHash("sha256").update(png).digest("base64"),
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([png], { type: "image/png" })));
  await f.member.action(api.assets.upload.finalize, { assetId: intent.assetId, storageId });
  const html = `<p>Image</p><image-component id="image" src="${intent.assetId}" status="uploaded"></image-component>`;
  await f.member.mutation(api.intakes.description.save, {
    taskId,
    expectedContentVersion: content.contentVersion,
    html,
  });
  expect((await f.member.query(api.intakes.description.get, { taskId })).html).toContain(intent.assetId);
  await expect(
    f.member.mutation(api.intakes.description.save, {
      taskId,
      expectedContentVersion: content.contentVersion,
      html: "<p>Stale</p>",
    })
  ).rejects.toThrow("changed");
  await expect(
    f.member.mutation(api.intakes.index.edit, {
      taskId,
      expectedUpdatedAt: metadata.intake.updatedAt,
      expectedTaskUpdatedAt: metadata.task.updatedAt,
      title: "Stale metadata",
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "blue", status: "todo", sortOrder: 0, isDefault: true },
  });
  const admission = await f.owner.query(api.intakes.index.get, { taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId,
    expectedUpdatedAt: admission.intake.updatedAt,
    expectedTaskUpdatedAt: admission.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
  const current = await f.member.query(api.intakes.index.get, { taskId });
  await f.member.mutation(api.intakes.index.edit, {
    taskId,
    expectedUpdatedAt: current.intake.updatedAt,
    expectedTaskUpdatedAt: current.task.updatedAt,
    title: "Metadata only",
    properties,
  });
  expect((await f.member.query(api.intakes.description.get, { taskId })).html).toContain(intent.assetId);
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: f.memberId, role: "guest" });
  const own = await f.member.query(api.intakes.description.get, { taskId });
  await f.member.mutation(api.intakes.description.save, {
    taskId,
    expectedContentVersion: own.contentVersion,
    html: own.html,
  });
  const other = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Other",
    html: "",
    priority: "none",
  });
  await expect(f.member.query(api.intakes.description.get, { taskId: other })).rejects.toThrow("not found");
});
