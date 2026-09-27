import { createHash } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { taskRichContent } from "../rich_content";
afterEach(() => vi.useRealTimers());
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Inline images" });
  return { ...f, taskId };
}
async function upload(f: Awaited<ReturnType<typeof fixture>>, taskId = f.taskId) {
  const ticket = await f.owner.mutation(api.assets.taskAttachments.prepare, {
    taskId,
    name: "image.png",
    contentType: "image/png",
    size: png.length,
    sha256: createHash("sha256").update(png).digest("base64"),
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([png], { type: "image/png" })));
  await f.owner.action(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
  return ticket.assetId;
}
const image = (src: string) =>
  `<p>Picture</p><image-component id="node" src="${src}" width="35%" height="auto" status="uploaded" onerror="evil()"></image-component>`;
test("own upload does not stale content token; image reference save preserves canonical storage and sanitizes attributes", async () => {
  const f = await fixture();
  const before = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  const id = await upload(f);
  await f.owner.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedContentVersion: before.contentVersion,
    html: image(id),
  });
  const saved = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  expect(saved.html).toContain(`src="${id}"`);
  expect(saved.html).not.toContain("onerror");
  expect(saved.contentVersion).not.toEqual(before.contentVersion);
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: before.contentVersion,
      html: "<p>Stale</p>",
    })
  ).rejects.toThrow("changed");
  expect(taskRichContent(image(id)).html).not.toContain("image-component");
});
test("failed or canceled edit never deletes saved images; committed unlink retains bytes and historical reference", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000000);
  const f = await fixture();
  const id = await upload(f);
  let current = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedContentVersion: current.contentVersion,
    html: image(id),
  });
  current = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  const scope = { kind: "task" as const, taskId: f.taskId };
  const version = (
    await f.owner.query(api.tasks.history.list, { scope, paginationOpts: { cursor: null, numItems: 10 } })
  ).page[0];
  vi.setSystemTime(1700001);
  await f.owner.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedContentVersion: current.contentVersion,
    html: "<p>Removed node</p>",
  });
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: current.contentVersion,
      html: "<p>Old draft</p>",
    })
  ).rejects.toThrow("changed");
  const asset = await f.owner.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: id });
  expect(asset.status).toBe("ready");
  expect((await f.owner.fetch(asset.downloadPath)).status).toBe(200);
  expect((await f.owner.query(api.tasks.history.get, { scope, versionId: version._id })).html).toContain(id);
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.history.restore, {
    scope,
    versionId: version._id,
    expectedVersionRevision: version.revision,
    expectedTaskUpdatedAt: task.updatedAt,
  });
  expect((await f.owner.query(api.tasks.description.get, { taskId: f.taskId })).html).toContain(id);
});
test("missing, foreign-task and remote image references reject atomically; explicit removal requires recovery before restoration", async () => {
  const f = await fixture();
  const other = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other" });
  const foreign = await upload(f, other);
  const before = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  await Promise.all(
    [foreign, "https://example.com/image.png", ""].map((src) =>
      expect(
        f.owner.mutation(api.tasks.description.save, {
          taskId: f.taskId,
          expectedContentVersion: before.contentVersion,
          html: image(src),
        })
      ).rejects.toThrow()
    )
  );
  expect(await f.owner.query(api.tasks.description.get, { taskId: f.taskId })).toEqual(before);
  const id = await upload(f);
  await f.owner.mutation(api.assets.taskAttachments.change, {
    taskId: f.taskId,
    assetId: id,
    expectedRevision: 0,
    deleted: true,
  });
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: before.contentVersion,
      html: image(id),
    })
  ).rejects.toThrow("not found");
  await f.owner.mutation(api.assets.taskAttachments.change, {
    taskId: f.taskId,
    assetId: id,
    expectedRevision: 1,
    deleted: false,
  });
  await f.owner.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedContentVersion: before.contentVersion,
    html: image(id),
  });
});
test("duplicate image has independent bytes and current task authorization", async () => {
  const f = await fixture();
  const id = await upload(f);
  const copy = await f.owner.action(api.assets.upload.duplicateTaskImage, { taskId: f.taskId, assetId: id });
  const rows = await f.t.run(async (ctx) => [await ctx.db.get(id), await ctx.db.get(copy)]);
  expect(rows[0]?.storageId).not.toBe(rows[1]?.storageId);
  await f.owner.mutation(api.assets.taskAttachments.change, {
    taskId: f.taskId,
    assetId: id,
    expectedRevision: 0,
    deleted: true,
  });
  const copied = await f.owner.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: copy });
  expect((await f.owner.fetch(copied.downloadPath)).status).toBe(200);
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(member!._id, { active: false });
  });
  await expect(
    f.owner.action(api.assets.upload.duplicateTaskImage, { taskId: f.taskId, assetId: copy })
  ).rejects.toThrow();
  expect((await f.owner.fetch(copied.downloadPath)).status).toBe(403);
});

test("content token rejects concurrent plain replacement; archival denies image save", async () => {
  const f = await fixture();
  const id = await upload(f);
  const old = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.index.update, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    title: task.title,
    description: "Plain replacement",
    status: task.status,
    priority: task.priority,
    assigneeIds: task.assigneeIds,
    labelIds: task.labelIds,
    startDate: task.startDate,
    targetDate: task.targetDate,
    stateId: task.stateId,
    estimatePointId: task.estimatePointId,
  });
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: old.contentVersion,
      html: image(id),
    })
  ).rejects.toThrow("changed");
  const current = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const latest = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: latest.updatedAt,
    operation: "archive",
  });
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: current.contentVersion,
      html: image(id),
    })
  ).rejects.toThrow();
  expect((await f.owner.query(api.tasks.description.get, { taskId: f.taskId })).contentVersion).toEqual(
    current.contentVersion
  );
});

test("null token protects an unversioned existing description from a second content write", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const versions = await ctx.db
      .query("taskDescriptionVersions")
      .withIndex("by_task", (q) => q.eq("taskId", f.taskId))
      .collect();
    await Promise.all(versions.map((version) => ctx.db.delete(version._id)));
  });
  expect((await f.owner.query(api.tasks.description.get, { taskId: f.taskId })).contentVersion).toBeNull();
  await f.owner.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedContentVersion: null,
    html: "<p>First</p>",
  });
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: null,
      html: "<p>Lost update</p>",
    })
  ).rejects.toThrow("changed");
});

test("transient editor nodes cannot be persisted even when their source bytes are ready", async () => {
  const f = await fixture();
  const id = await upload(f);
  const before = await f.owner.query(api.tasks.description.get, { taskId: f.taskId });
  await expect(
    f.owner.mutation(api.tasks.description.save, {
      taskId: f.taskId,
      expectedContentVersion: before.contentVersion,
      html: image(id).replace('status="uploaded"', 'status="uploading"'),
    })
  ).rejects.toThrow("Finish uploading");
  expect((await f.owner.query(api.tasks.description.get, { taskId: f.taskId })).contentVersion).toEqual(
    before.contentVersion
  );
});
