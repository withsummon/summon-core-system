// Scenarios intentionally preserve mutation and dependent pagination order.
/* eslint-disable no-await-in-loop */
import { describe, expect, it } from "vitest";
import { workspaceJourney } from "../../../test-support/fixtures";
import { api } from "../../_generated/api";

const page = { numItems: 2, cursor: null };
async function reportJourney() {
  const fixture = await workspaceJourney();
  const scope = {
    workspaceId: fixture.workspaceId,
    projectId: null,
    clientId: null,
    dateFrom: null,
    dateTo: null,
    today: "2026-09-27",
  };
  return { ...fixture, scope };
}
describe("Permission-filtered report contributions", () => {
  it("counts all pages exactly without calling a first page a total", async () => {
    const { owner, scope, projectId } = await reportJourney();
    for (const [status, targetDate] of [
      ["todo", "2026-09-26"],
      ["done", "2026-09-26"],
      ["cancelled", "2026-09-26"],
      ["in_progress", "2026-10-04"],
      ["todo", "2026-10-05"],
    ] as const) {
      await owner.mutation(api.tasks.index.create, {
        projectId,
        title: status,
        status,
        properties: {
          estimatePointId: null,
          targetDate,
          startDate: null,
          stateId: null,
          assigneeIds: [],
          labelIds: [],
          priority: "none",
        },
      });
    }
    const first = await owner.query(api.reporting.tasks.page, { scope, paginationOpts: page });
    expect(first.coverage).toBe("page");
    expect(first.isDone).toBe(false);
    expect(first.contribution.total).toBe(2);
    const totals = { ...first.contribution };
    let cursor = first.continueCursor;
    let done = first.isDone;
    while (!done) {
      const result = await owner.query(api.reporting.tasks.page, { scope, paginationOpts: { ...page, cursor } });
      totals.total += result.contribution.total;
      totals.completed += result.contribution.completed;
      totals.overdue += result.contribution.overdue;
      totals.dueInSevenDays += result.contribution.dueInSevenDays;
      totals.later += result.contribution.later;
      cursor = result.continueCursor;
      done = result.isDone;
    }
    expect(totals).toMatchObject({ total: 5, completed: 1, overdue: 1, dueInSevenDays: 1, later: 1 });
  });
  it("does not count a hidden project for a workspace administrator", async () => {
    const { t, owner, workspaceId, projectId, userId, scope } = await reportJourney();
    await owner.mutation(api.tasks.index.create, { projectId, title: "Hidden" });
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      await ctx.db.patch(membership!._id, { active: false });
    });
    expect((await owner.query(api.reporting.tasks.page, { scope, paginationOpts: page })).contribution.total).toBe(0);
    expect((await owner.query(api.reporting.projects.page, { scope, paginationOpts: page })).contribution.count).toBe(
      0
    );
    await expect(
      owner.query(api.reporting.tasks.page, { scope: { ...scope, projectId }, paginationOpts: page })
    ).rejects.toThrow("access");
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
    await expect(
      t
        .withIdentity({ subject: strangerId })
        .query(api.reporting.tasks.page, { scope: { ...scope, workspaceId }, paginationOpts: page })
    ).rejects.toThrow("workspace");
  });
  it("applies inclusive UTC creation-date filters and validates pagination/date input", async () => {
    const { owner, projectId, scope } = await reportJourney();
    await owner.mutation(api.tasks.index.create, { projectId, title: "Today" });
    const today = new Date().toISOString().slice(0, 10);
    expect(
      (
        await owner.query(api.reporting.tasks.page, {
          scope: { ...scope, dateFrom: today, dateTo: today },
          paginationOpts: page,
        })
      ).contribution.total
    ).toBe(1);
    expect(
      (await owner.query(api.reporting.tasks.page, { scope: { ...scope, dateTo: "2000-01-01" }, paginationOpts: page }))
        .contribution.total
    ).toBe(0);
    for (const numItems of [0, 1.5, 101])
      await expect(
        owner.query(api.reporting.tasks.page, { scope, paginationOpts: { numItems, cursor: null } })
      ).rejects.toThrow("1–100");
    await expect(
      owner.query(api.reporting.tasks.page, { scope: { ...scope, today: "2026-02-30" }, paginationOpts: page })
    ).rejects.toThrow("date");
    await expect(
      owner.query(api.reporting.tasks.page, {
        scope: { ...scope, dateFrom: "2026-10-01", dateTo: "2026-09-01" },
        paginationOpts: page,
      })
    ).rejects.toThrow("reversed");
  });
  it("sums commercial decimals exactly and keeps projectless meetings out of project scope", async () => {
    const { owner, workspaceId, projectId, scope } = await reportJourney();
    for (const [stage, value] of [
      ["lead", "9999999999999999.99"],
      ["lead", "0.02"],
      ["won", "100.00"],
    ] as const)
      await owner.mutation(api.commercial.opportunities.save, {
        workspaceId,
        data: {
          title: `Opportunity ${value}`,
          product: "",
          source: "",
          description: "",
          stage,
          value,
          probability: 0,
          expectedCloseDate: null,
          clientId: null,
          ownerId: null,
        },
      });
    const result = await owner.query(api.reporting.commercial.opportunities, {
      scope,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.contribution).toMatchObject({
      count: 3,
      pipelineValue: "10000000000000000.01",
      stages: { lead: { count: 2, value: "10000000000000000.01" } },
    });
    expect(
      (
        await owner.query(api.reporting.commercial.opportunities, {
          scope: { ...scope, projectId },
          paginationOpts: page,
        })
      ).contribution.count
    ).toBe(0);
    await owner.mutation(api.meetings.index.save, {
      workspaceId,
      data: {
        title: "Workspace meeting",
        agenda: "",
        notes: "",
        location: "",
        meetingUrl: "",
        status: "scheduled",
        startsAt: Date.UTC(2026, 8, 27),
        endsAt: null,
        projectId: null,
        summaryDocumentId: null,
      },
      participantIds: [],
    });
    expect((await owner.query(api.reporting.meetings.page, { scope, paginationOpts: page })).contribution.total).toBe(
      1
    );
    expect(
      (await owner.query(api.reporting.meetings.page, { scope: { ...scope, projectId }, paginationOpts: page }))
        .contribution.total
    ).toBe(0);
  });
  it("excludes another owner's private document even for a workspace administrator", async () => {
    const { t, owner, workspaceId, scope } = await reportJourney();
    const peerId = await t.run((ctx) => ctx.db.insert("users", { name: "Peer" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: peerId, role: "member" });
    await t.withIdentity({ subject: peerId }).mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [],
      name: "Private",
      access: "private",
      isGlobal: false,
      color: "",
      viewProps: {},
      logoProps: {},
      sortOrder: 1,
      category: "",
      tags: [],
      clientId: null,
      opportunityId: null,
      externalId: null,
      externalSource: null,
    });
    expect((await owner.query(api.reporting.documents.page, { scope, paginationOpts: page })).contribution.count).toBe(
      0
    );
    expect(
      (await t.withIdentity({ subject: peerId }).query(api.reporting.documents.page, { scope, paginationOpts: page }))
        .contribution.count
    ).toBe(1);
  });
});
