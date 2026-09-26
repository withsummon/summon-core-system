import { describe, expect, test } from "vitest";
import type { FunctionArgs } from "convex/server";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const meetingData = {
  title: "Weekly review",
  agenda: "Review delivery",
  notes: "",
  location: "Jakarta",
  meetingUrl: "https://meet.example.com/weekly",
  status: "scheduled",
  startsAt: Date.UTC(2026, 8, 27, 10),
  endsAt: Date.UTC(2026, 8, 27, 11),
  projectId: null,
  summaryDocumentId: null,
} satisfies FunctionArgs<typeof api.meetings.index.save>["data"];
async function meetingJourney() {
  const journey = await workspaceJourney();
  const meetingId = await journey.owner.mutation(api.meetings.index.save, {
    workspaceId: journey.workspaceId,
    data: { ...meetingData, projectId: journey.projectId },
    participantIds: [journey.userId],
  });
  return { ...journey, meetingId };
}
describe("meeting lifecycle", () => {
  test("a revoked participant remains identifiable and can be removed while saving meeting edits", async () => {
    const { t, owner, workspaceId, meetingId, projectId } = await meetingJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Former participant" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      data: { ...meetingData, projectId },
      participantIds: [userId],
    });
    await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId });
    expect(await owner.query(api.meetings.index.participants, { workspaceId, meetingId })).toMatchObject([
      { userId, name: "Former participant" },
    ]);
    const directory = await owner.query(api.commercial.directory.members, {
      workspaceId,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(directory.page.some((person) => person.id === userId)).toBe(false);
    await owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      data: { ...meetingData, projectId, notes: "Updated after removal" },
      participantIds: [],
    });
    expect(await owner.query(api.meetings.index.participants, { workspaceId, meetingId })).toEqual([]);
    expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({
      notes: "Updated after removal",
    });
  });
  test("given a project writer, meeting CRUD preserves organizer and participants without creating tasks", async () => {
    const { t, owner, workspaceId, projectId, userId, meetingId } = await meetingJourney();
    expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({
      title: "Weekly review",
      organizerId: userId,
    });
    expect(await owner.query(api.meetings.index.participants, { workspaceId, meetingId })).toMatchObject([
      { userId, response: "pending" },
    ]);
    await owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      data: { ...meetingData, projectId, notes: "Send proposal", status: "completed" },
      participantIds: [],
    });
    expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({
      notes: "Send proposal",
      status: "completed",
      organizerId: userId,
    });
    expect(await owner.query(api.meetings.index.participants, { workspaceId, meetingId })).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("tasks").collect())).toEqual([]);
    await owner.mutation(api.meetings.index.remove, { workspaceId, meetingId });
    await expect(owner.query(api.meetings.index.get, { workspaceId, meetingId })).rejects.toThrow("not found");
    expect(
      (await owner.query(api.meetings.index.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } })).page
    ).toEqual([]);
  });
  test("given an invalid participant, the atomic save leaves no meeting behind", async () => {
    const { t, owner, workspaceId } = await workspaceJourney();
    const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Outsider" }));
    await expect(
      owner.mutation(api.meetings.index.save, { workspaceId, data: meetingData, participantIds: [otherId] })
    ).rejects.toThrow("active workspace");
    expect(
      (await owner.query(api.meetings.index.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } })).page
    ).toEqual([]);
  });
  test.each([NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER])("rejects invalid meeting timestamp %s", async (startsAt) => {
    const { owner, workspaceId } = await workspaceJourney();
    await expect(
      owner.mutation(api.meetings.index.save, { workspaceId, data: { ...meetingData, startsAt }, participantIds: [] })
    ).rejects.toThrow("timestamps");
  });
  test("rejects inverted times, unsafe URLs, duplicate participants and unauthorized project references", async () => {
    const { owner, workspaceId, userId } = await workspaceJourney();
    await expect(
      owner.mutation(api.meetings.index.save, {
        workspaceId,
        data: { ...meetingData, endsAt: meetingData.startsAt - 1 },
        participantIds: [],
      })
    ).rejects.toThrow("before");
    await expect(
      owner.mutation(api.meetings.index.save, {
        workspaceId,
        data: { ...meetingData, meetingUrl: "javascript:alert(1)" },
        participantIds: [],
      })
    ).rejects.toThrow("HTTP");
    await expect(
      owner.mutation(api.meetings.index.save, { workspaceId, data: meetingData, participantIds: [userId, userId] })
    ).rejects.toThrow("distinct");
    const otherWorkspace = await owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    const otherProject = await owner.mutation(api.projects.index.create, {
      workspaceId: otherWorkspace,
      name: "Other",
      identifier: "OTH",
    });
    await expect(
      owner.mutation(api.meetings.index.save, {
        workspaceId,
        data: { ...meetingData, projectId: otherProject },
        participantIds: [],
      })
    ).rejects.toThrow("another workspace");
  });
  test("given project membership revoked, meeting reads and writes are denied and lists filter it", async () => {
    const { t, owner, workspaceId, projectId, userId, meetingId } = await meetingJourney();
    const member = await t.run((ctx) =>
      ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique()
    );
    await t.run((ctx) => ctx.db.patch(member!._id, { role: "guest" }));
    expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({ _id: meetingId });
    await expect(owner.mutation(api.meetings.index.remove, { workspaceId, meetingId })).rejects.toThrow("access");
    await t.run((ctx) => ctx.db.patch(member!._id, { active: false }));
    await expect(owner.query(api.meetings.index.get, { workspaceId, meetingId })).rejects.toThrow("access");
    expect(
      (await owner.query(api.meetings.index.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } })).page
    ).toEqual([]);
  });
  test("given workspace meetings, members can read but workspace guests cannot write", async () => {
    const { t, owner, workspaceId, userId } = await workspaceJourney();
    const meetingId = await owner.mutation(api.meetings.index.save, {
      workspaceId,
      data: meetingData,
      participantIds: [],
    });
    const member = await t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
        .unique()
    );
    await t.run((ctx) => ctx.db.patch(member!._id, { role: "guest" }));
    expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({ _id: meetingId });
    await expect(
      owner.mutation(api.meetings.index.save, { workspaceId, meetingId, data: meetingData, participantIds: [] })
    ).rejects.toThrow("access");
  });
});
describe("explicit meeting task links", () => {
  test("given an existing task, linking reads its current status, rejects duplicates and unlinking leaves the task intact", async () => {
    const { owner, workspaceId, projectId, meetingId } = await meetingJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Send proposal" });
    const linkId = await owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId });
    await expect(owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId })).rejects.toThrow(
      "already linked"
    );
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
    const links = await owner.query(api.meetings.tasks.list, {
      workspaceId,
      meetingId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(links.page).toMatchObject([{ linkId, task: { _id: taskId, title: "Send proposal", status: "done" } }]);
    await expect(
      owner.mutation(api.meetings.index.save, { workspaceId, meetingId, data: meetingData, participantIds: [] })
    ).rejects.toThrow("Unlink");
    await owner.mutation(api.meetings.tasks.unlink, { workspaceId, meetingId, linkId });
    expect(
      (
        await owner.query(api.meetings.tasks.list, {
          workspaceId,
          meetingId,
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
    ).toEqual([]);
    expect(
      (await owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })).page
    ).toMatchObject([{ _id: taskId }]);
  });
  test("given a task in another project or workspace, linking rejects the relationship", async () => {
    const { owner, workspaceId, meetingId } = await meetingJourney();
    const otherProject = await owner.mutation(api.projects.index.create, {
      workspaceId,
      name: "Other",
      identifier: "OTH",
    });
    const taskId = await owner.mutation(api.tasks.index.create, { projectId: otherProject, title: "Other" });
    await expect(owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId })).rejects.toThrow(
      "meeting project"
    );
    const otherWorkspace = await owner.mutation(api.workspaces.index.create, { name: "Foreign", slug: "foreign" });
    const foreignProject = await owner.mutation(api.projects.index.create, {
      workspaceId: otherWorkspace,
      name: "Foreign",
      identifier: "FOR",
    });
    const foreignTask = await owner.mutation(api.tasks.index.create, { projectId: foreignProject, title: "Foreign" });
    await expect(
      owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId: foreignTask })
    ).rejects.toThrow("this workspace");
  });
  test("given a workspace meeting, task access is checked separately and revoked links disappear", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const meetingId = await owner.mutation(api.meetings.index.save, {
      workspaceId,
      data: meetingData,
      participantIds: [],
    });
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Private task" });
    await owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId });
    const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: otherId, role: "member" });
    const other = t.withIdentity({ subject: otherId });
    await expect(other.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId })).rejects.toThrow("access");
    expect(
      (
        await other.query(api.meetings.tasks.list, {
          workspaceId,
          meetingId,
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
    ).toEqual([]);
    await owner.mutation(api.projects.index.grantMember, { projectId, userId: otherId, role: "member" });
    expect(
      (
        await other.query(api.meetings.tasks.list, {
          workspaceId,
          meetingId,
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
    ).toHaveLength(1);
    await owner.mutation(api.projects.index.revokeMember, { projectId, userId: otherId });
    expect(
      (
        await other.query(api.meetings.tasks.list, {
          workspaceId,
          meetingId,
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
    ).toEqual([]);
  });
  test("given concurrent identical links, exactly one relationship commits", async () => {
    const { t, owner, workspaceId, projectId, meetingId } = await meetingJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "One task" });
    const results = await Promise.allSettled([
      owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId }),
      owner.mutation(api.meetings.tasks.link, { workspaceId, meetingId, taskId }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("meetingTasks").collect())).toHaveLength(1);
  });
});

describe("meeting document references", () => {
  test("given a private summary document, only an authorized reader may link it and foreign workspaces cannot reuse it", async () => {
    const { t, owner, workspaceId, projectId, meetingId } = await meetingJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      name: "Minutes",
      access: "private",
      isGlobal: false,
      projectIds: [projectId],
      color: "",
      viewProps: {},
      logoProps: {},
      sortOrder: 0,
      category: "",
      tags: [],
      clientId: null,
      opportunityId: null,
      externalId: null,
      externalSource: null,
    });
    await owner.mutation(api.meetings.index.save, {
      workspaceId,
      meetingId,
      data: { ...meetingData, projectId, summaryDocumentId: documentId },
      participantIds: [],
    });
    expect(await owner.query(api.meetings.index.get, { workspaceId, meetingId })).toMatchObject({
      summaryDocumentId: documentId,
    });
    const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: otherId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId: otherId, role: "member" });
    const other = t.withIdentity({ subject: otherId });
    await expect(
      other.mutation(api.meetings.index.save, {
        workspaceId,
        meetingId,
        data: { ...meetingData, projectId, summaryDocumentId: documentId },
        participantIds: [],
      })
    ).rejects.toThrow("Document access");
    const otherWorkspace = await owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    await expect(
      owner.mutation(api.meetings.index.save, {
        workspaceId: otherWorkspace,
        data: { ...meetingData, summaryDocumentId: documentId },
        participantIds: [],
      })
    ).rejects.toThrow("another workspace");
    expect(await t.run((ctx) => ctx.db.query("tasks").collect())).toEqual([]);
  });
});

test("editing meeting details preserves responses for retained participants", async () => {
  const { t, owner, workspaceId, meetingId, projectId, userId } = await meetingJourney();
  const participant = await t.run((ctx) =>
    ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
      .unique()
  );
  await t.run((ctx) => ctx.db.patch(participant!._id, { response: "accepted" }));
  await owner.mutation(api.meetings.index.save, {
    workspaceId,
    meetingId,
    data: { ...meetingData, projectId, notes: "Updated notes" },
    participantIds: [userId],
  });
  expect(await owner.query(api.meetings.index.participants, { workspaceId, meetingId })).toMatchObject([
    { id: participant!._id, userId, response: "accepted" },
  ]);
});

test("meeting visibility does not grant access to a summary document after its ACL changes", async () => {
  const { t, owner, workspaceId, projectId, meetingId } = await meetingJourney();
  const metadata = {
    name: "Minutes",
    access: "public" as const,
    isGlobal: false,
    projectIds: [projectId],
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  };
  const documentId = await owner.mutation(api.documents.index.create, { workspaceId, ...metadata });
  await owner.mutation(api.meetings.index.save, {
    workspaceId,
    meetingId,
    data: { ...meetingData, projectId, summaryDocumentId: documentId },
    participantIds: [],
  });
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: otherId, role: "member" });
  await owner.mutation(api.projects.index.grantMember, { projectId, userId: otherId, role: "member" });
  const other = t.withIdentity({ subject: otherId });
  expect(await other.query(api.documents.index.get, { documentId })).toMatchObject({ name: "Minutes" });
  await owner.mutation(api.documents.index.update, { documentId, ...metadata, access: "private" });
  const meeting = await other.query(api.meetings.index.get, { workspaceId, meetingId });
  expect(meeting).toMatchObject({ summaryDocumentId: documentId });
  expect(meeting).not.toHaveProperty("summaryDocument");
  await expect(other.query(api.documents.index.get, { documentId })).rejects.toThrow("Document access");
});
