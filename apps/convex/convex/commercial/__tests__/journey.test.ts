import { signedIn } from "../../../test-support/session";
import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import type { FunctionArgs } from "convex/server";

const clientData = {
  name: "Acme",
  companyName: "Acme Ltd",
  industry: "Technology",
  email: "hello@example.com",
  phone: "",
  website: "https://example.com",
  headOffice: "Jakarta",
  relationshipStartedAt: "2026-09-27",
  notes: "",
  status: "active",
  ownerId: null,
  externalSource: null,
  externalId: null,
} satisfies FunctionArgs<typeof api.commercial.clients.save>["data"];
const opportunityData = {
  title: "Core implementation",
  product: "Core",
  source: "Referral",
  description: "",
  stage: "lead",
  value: "9999999999999999.99",
  probability: 20,
  expectedCloseDate: "2026-12-31",
  clientId: null,
  ownerId: null,
} satisfies FunctionArgs<typeof api.commercial.opportunities.save>["data"];
const contactData = { name: "Finance", title: "Director", email: "finance@example.com", phone: "", isPrimary: true };
const profileData = {
  clientId: null,
  deliveryStatus: "active",
  phase: "Implementation",
  health: "on_track",
  startDate: "2026-09-27",
  targetDate: "2026-12-31",
  budget: "9999999999999999.99",
} satisfies FunctionArgs<typeof api.commercial.delivery.saveProfile>["data"];
async function commercialJourney() {
  const journey = await workspaceJourney();
  const clientId = await journey.owner.mutation(api.commercial.clients.save, {
    workspaceId: journey.workspaceId,
    data: clientData,
  });
  const opportunityId = await journey.owner.mutation(api.commercial.opportunities.save, {
    workspaceId: journey.workspaceId,
    data: { ...opportunityData, clientId },
  });
  return { ...journey, clientId, opportunityId };
}

describe("commercial records", () => {
  test("given a workspace writer, client/contact CRUD survives reads and enforces unique names/emails", async () => {
    const { owner, workspaceId, clientId } = await commercialJourney();
    await expect(owner.mutation(api.commercial.clients.save, { workspaceId, data: clientData })).rejects.toThrow(
      "already exists"
    );
    await owner.mutation(api.commercial.clients.save, {
      workspaceId,
      clientId,
      data: { ...clientData, name: "Acme updated" },
    });
    expect(await owner.query(api.commercial.clients.get, { workspaceId, clientId })).toMatchObject({
      name: "Acme updated",
      relationshipStartedAt: "2026-09-27",
    });
    const contactId = await owner.mutation(api.commercial.contacts.save, { workspaceId, clientId, data: contactData });
    await expect(
      owner.mutation(api.commercial.contacts.save, { workspaceId, clientId, data: contactData })
    ).rejects.toThrow("already exists");
    await owner.mutation(api.commercial.contacts.save, {
      workspaceId,
      clientId,
      contactId,
      data: { ...contactData, title: "CFO" },
    });
    expect(
      (
        await owner.query(api.commercial.contacts.list, {
          workspaceId,
          clientId,
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
    ).toMatchObject([{ title: "CFO" }]);
    await owner.mutation(api.commercial.contacts.remove, { workspaceId, clientId, contactId });
    expect(
      (
        await owner.query(api.commercial.contacts.list, {
          workspaceId,
          clientId,
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
    ).toEqual([]);
    await owner.mutation(api.commercial.clients.remove, { workspaceId, clientId });
    await expect(owner.query(api.commercial.clients.get, { workspaceId, clientId })).rejects.toThrow("not found");
    await expect(
      owner.mutation(api.commercial.contacts.save, { workspaceId, clientId, data: contactData })
    ).rejects.toThrow("not found");
    await owner.mutation(api.commercial.clients.save, { workspaceId, data: clientData });
  });
  test("given an opportunity, transitions preserve probability unless supplied and amounts retain all decimal digits", async () => {
    const { owner, workspaceId, opportunityId } = await commercialJourney();
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "proposal" });
    expect(await owner.query(api.commercial.opportunities.get, { workspaceId, opportunityId })).toMatchObject({
      stage: "proposal",
      probability: 20,
      value: "9999999999999999.99",
    });
    await owner.mutation(api.commercial.opportunities.transition, {
      workspaceId,
      opportunityId,
      stage: "won",
      probability: 100,
    });
    expect(await owner.query(api.commercial.opportunities.get, { workspaceId, opportunityId })).toMatchObject({
      stage: "won",
      probability: 100,
    });
    await owner.mutation(api.commercial.opportunities.remove, { workspaceId, opportunityId });
    await expect(owner.query(api.commercial.opportunities.get, { workspaceId, opportunityId })).rejects.toThrow(
      "not found"
    );
  });
  test.each(["10000000000000000", "1.001", "NaN", "1e2", "Infinity"])(
    "rejects non-decimal or oversized amount %s",
    async (value) => {
      const { owner, workspaceId } = await workspaceJourney();
      await expect(
        owner.mutation(api.commercial.opportunities.save, { workspaceId, data: { ...opportunityData, value } })
      ).rejects.toThrow("decimal");
    }
  );
  test.each([NaN, Infinity, -1, 101, 1.5])("rejects invalid probability %s", async (probability) => {
    const { owner, workspaceId, opportunityId } = await commercialJourney();
    await expect(
      owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won", probability })
    ).rejects.toThrow("integer");
  });
  test("rejects invalid dates, URLs, emails and bounded text at the write owner", async () => {
    const { owner, workspaceId } = await workspaceJourney();
    await Promise.all(
      [
        { ...clientData, relationshipStartedAt: "2026-02-30" },
        { ...clientData, website: "javascript:alert(1)" },
        { ...clientData, email: "wrong" },
        { ...clientData, name: " " },
      ].map((data) => expect(owner.mutation(api.commercial.clients.save, { workspaceId, data })).rejects.toThrow())
    );
  });
  test("given cross-workspace references, rejects owners, clients and nested contact moves", async () => {
    const { t, owner, workspaceId, clientId } = await commercialJourney();
    const otherUserId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
    const other = await signedIn(t, otherUserId);
    const otherWorkspaceId = await other.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    const otherClientId = await other.mutation(api.commercial.clients.save, {
      workspaceId: otherWorkspaceId,
      data: clientData,
    });
    await expect(
      owner.mutation(api.commercial.clients.save, {
        workspaceId,
        clientId,
        data: { ...clientData, ownerId: otherUserId },
      })
    ).rejects.toThrow("active member");
    await expect(
      owner.mutation(api.commercial.opportunities.save, {
        workspaceId,
        data: { ...opportunityData, clientId: otherClientId },
      })
    ).rejects.toThrow("not found");
    await expect(other.query(api.commercial.clients.get, { workspaceId, clientId })).rejects.toThrow("access");
    const contactId = await other.mutation(api.commercial.contacts.save, {
      workspaceId: otherWorkspaceId,
      clientId: otherClientId,
      data: contactData,
    });
    await expect(
      owner.mutation(api.commercial.contacts.save, { workspaceId, clientId, contactId, data: contactData })
    ).rejects.toThrow("not found");
  });
  test("given a guest or revoked member, read/write follows current workspace membership", async () => {
    const { t, owner, workspaceId, clientId, userId } = await commercialJourney();
    const membership = await t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
        .unique()
    );
    await t.run((ctx) => ctx.db.patch(membership!._id, { role: "guest" }));
    expect(await owner.query(api.commercial.clients.get, { workspaceId, clientId })).toMatchObject({ _id: clientId });
    await expect(owner.mutation(api.commercial.clients.remove, { workspaceId, clientId })).rejects.toThrow("access");
    await t.run((ctx) => ctx.db.patch(membership!._id, { active: false }));
    await expect(owner.query(api.commercial.clients.get, { workspaceId, clientId })).rejects.toThrow("access");
  });
});

describe("atomic delivery handoff", () => {
  test("given a won opportunity, link is retry-safe and stage corrections retain the delivery project", async () => {
    const { owner, workspaceId, opportunityId, projectId, clientId } = await commercialJourney();
    const input = { workspaceId, opportunityId, target: { kind: "existing" as const, projectId } };
    await expect(owner.mutation(api.commercial.delivery.start, input)).rejects.toThrow("won");
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    const results = await Promise.all([
      owner.mutation(api.commercial.delivery.start, input),
      owner.mutation(api.commercial.delivery.start, input),
    ]);
    expect(new Set(results.map((r) => r.profileId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const another = await owner.mutation(api.projects.index.create, {
      workspaceId,
      name: "Other",
      identifier: "OTHER",
    });
    await expect(
      owner.mutation(api.commercial.delivery.start, { ...input, target: { kind: "existing", projectId: another } })
    ).rejects.toThrow("already has");
    await expect(
      owner.mutation(api.commercial.opportunities.save, {
        workspaceId,
        opportunityId,
        data: { ...opportunityData, clientId: null },
      })
    ).rejects.toThrow("cannot change");
    await expect(owner.mutation(api.commercial.delivery.saveProfile, { projectId, data: profileData })).rejects.toThrow(
      "must match"
    );
    await owner.mutation(api.commercial.delivery.saveProfile, { projectId, data: { ...profileData, clientId } });
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "negotiation" });
    expect(await owner.query(api.commercial.delivery.getProfile, { projectId })).toMatchObject({
      sourceOpportunityId: opportunityId,
      clientId,
      budget: "9999999999999999.99",
      phase: "Implementation",
    });
  });
  test("given concurrent create handoffs, exactly one project and its administrator membership are committed", async () => {
    const { t, owner, workspaceId, opportunityId, userId } = await commercialJourney();
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    const input = {
      workspaceId,
      opportunityId,
      target: { kind: "create" as const, name: "New delivery", identifier: "NEW" },
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => owner.mutation(api.commercial.delivery.start, input))
    );
    expect(new Set(results.map((r) => r.projectId)).size).toBe(1);
    expect(await owner.query(api.projects.index.list, { workspaceId })).toHaveLength(2);
    const member = await t.run((ctx) =>
      ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", results[0].projectId).eq("userId", userId))
        .unique()
    );
    expect(member).toMatchObject({ role: "admin", active: true });
  });
  test("given competing won opportunities for one project, one succeeds and the other conflicts", async () => {
    const { owner, workspaceId, opportunityId, projectId, clientId } = await commercialJourney();
    const otherId = await owner.mutation(api.commercial.opportunities.save, {
      workspaceId,
      data: { ...opportunityData, title: "Other deal", clientId, stage: "won" },
    });
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    const results = await Promise.allSettled(
      [opportunityId, otherId].map((id) =>
        owner.mutation(api.commercial.delivery.start, {
          workspaceId,
          opportunityId: id,
          target: { kind: "existing", projectId },
        })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  test("given a workspace admin lacking project membership, delivery and profile do not bypass project access", async () => {
    const { t, owner, workspaceId, opportunityId, projectId, userId } = await commercialJourney();
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    const membership = await t.run((ctx) =>
      ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique()
    );
    await t.run((ctx) => ctx.db.patch(membership!._id, { active: false }));
    await expect(
      owner.mutation(api.commercial.delivery.start, {
        workspaceId,
        opportunityId,
        target: { kind: "existing", projectId },
      })
    ).rejects.toThrow("access");
    await expect(owner.query(api.commercial.delivery.getProfile, { projectId })).rejects.toThrow("access");
    expect(await t.run((ctx) => ctx.db.query("projectProfiles").collect())).toEqual([]);
  });
  test("given invalid create input or a deleted client, handoff leaves no orphan project", async () => {
    const { owner, workspaceId, opportunityId, clientId } = await commercialJourney();
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    await expect(
      owner.mutation(api.commercial.delivery.start, {
        workspaceId,
        opportunityId,
        target: { kind: "create", name: "Bad", identifier: "!" },
      })
    ).rejects.toThrow("identifier");
    expect(await owner.query(api.projects.index.list, { workspaceId })).toHaveLength(1);
    await owner.mutation(api.commercial.clients.remove, { workspaceId, clientId });
    await expect(
      owner.mutation(api.commercial.delivery.start, {
        workspaceId,
        opportunityId,
        target: { kind: "create", name: "New", identifier: "NEW" },
      })
    ).rejects.toThrow("not found");
    expect(await owner.query(api.projects.index.list, { workspaceId })).toHaveLength(1);
  });
  test("given a compatible profile, handoff retains delivery fields; inverted dates are rejected", async () => {
    const { owner, workspaceId, opportunityId, projectId, clientId } = await commercialJourney();
    await expect(
      owner.mutation(api.commercial.delivery.saveProfile, {
        projectId,
        data: { ...profileData, startDate: "2027-01-01" },
      })
    ).rejects.toThrow("before");
    const profileId = await owner.mutation(api.commercial.delivery.saveProfile, { projectId, data: profileData });
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    expect(
      await owner.mutation(api.commercial.delivery.start, {
        workspaceId,
        opportunityId,
        target: { kind: "existing", projectId },
      })
    ).toEqual({ profileId, projectId, created: false });
    expect(await owner.query(api.commercial.delivery.getProfile, { projectId })).toMatchObject({
      clientId,
      phase: "Implementation",
      deliveryStatus: "active",
    });
  });
});

describe("commercial reference visibility", () => {
  test("given a linked project hidden from another workspace member, handoff lookup hides its identifiers", async () => {
    const { t, owner, workspaceId, opportunityId, projectId } = await commercialJourney();
    await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
    await owner.mutation(api.commercial.delivery.start, {
      workspaceId,
      opportunityId,
      target: { kind: "existing", projectId },
    });
    expect(await owner.query(api.commercial.delivery.getForOpportunity, { workspaceId, opportunityId })).toMatchObject({
      project: { _id: projectId },
    });
    const otherId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "Colleague" });
      await ctx.db.insert("workspaceMembers", { workspaceId, userId: id, role: "member", active: true });
      return id;
    });
    const other = await signedIn(t, otherId);
    expect(await other.query(api.commercial.delivery.getForOpportunity, { workspaceId, opportunityId })).toBeNull();
    const directory = await other.query(api.commercial.directory.members, {
      workspaceId,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(directory.page).toHaveLength(2);
    expect(directory.page.some((user) => user.id === otherId)).toBe(true);
    await owner.mutation(api.projects.index.grantMember, { projectId, userId: otherId, role: "member" });
    expect(await other.query(api.commercial.delivery.getForOpportunity, { workspaceId, opportunityId })).toMatchObject({
      project: { _id: projectId },
    });
    await expect(
      other.mutation(api.commercial.delivery.start, {
        workspaceId,
        opportunityId,
        target: { kind: "existing", projectId },
      })
    ).rejects.toThrow("administrators");
    await expect(other.mutation(api.commercial.delivery.saveProfile, { projectId, data: profileData })).rejects.toThrow(
      "administrators"
    );
  });
});

test("given revoked existing references, a record save revalidates the current owner and client", async () => {
  const { t, owner, workspaceId, opportunityId, clientId } = await commercialJourney();
  const personId = await t.run((ctx) => ctx.db.insert("users", { name: "Account owner" }));
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: personId, role: "member" });
  const data = { ...opportunityData, clientId, ownerId: personId };
  await owner.mutation(api.commercial.opportunities.save, { workspaceId, opportunityId, data });
  await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId: personId });
  await expect(
    owner.mutation(api.commercial.opportunities.save, {
      workspaceId,
      opportunityId,
      data: { ...data, description: "Changed" },
    })
  ).rejects.toThrow("active member");
  await owner.mutation(api.commercial.clients.remove, { workspaceId, clientId });
  await expect(
    owner.mutation(api.commercial.opportunities.save, { workspaceId, opportunityId, data: { ...data, ownerId: null } })
  ).rejects.toThrow("not found");
});
test("given authority in two workspaces, cross-workspace and archived delivery targets are rejected", async () => {
  const { t, owner, workspaceId, opportunityId, projectId } = await commercialJourney();
  await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
  const otherWorkspaceId = await owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
  const foreignProject = await owner.mutation(api.projects.index.create, {
    workspaceId: otherWorkspaceId,
    name: "Foreign",
    identifier: "FOR",
  });
  await expect(
    owner.mutation(api.commercial.delivery.start, {
      workspaceId,
      opportunityId,
      target: { kind: "existing", projectId: foreignProject },
    })
  ).rejects.toThrow("this workspace");
  await t.run((ctx) => ctx.db.patch(projectId, { archived: true }));
  await expect(
    owner.mutation(api.commercial.delivery.start, {
      workspaceId,
      opportunityId,
      target: { kind: "existing", projectId },
    })
  ).rejects.toThrow("not found");
  expect(await t.run((ctx) => ctx.db.query("projectProfiles").collect())).toEqual([]);
});
test("given a profile for another client, handoff rejects without overwriting its commercial fields", async () => {
  const { owner, workspaceId, opportunityId, projectId } = await commercialJourney();
  const otherClient = await owner.mutation(api.commercial.clients.save, {
    workspaceId,
    data: { ...clientData, name: "Another" },
  });
  await owner.mutation(api.commercial.delivery.saveProfile, {
    projectId,
    data: { ...profileData, clientId: otherClient },
  });
  await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
  await expect(
    owner.mutation(api.commercial.delivery.start, {
      workspaceId,
      opportunityId,
      target: { kind: "existing", projectId },
    })
  ).rejects.toThrow("another client");
  expect(await owner.query(api.commercial.delivery.getProfile, { projectId })).toMatchObject({
    clientId: otherClient,
    sourceOpportunityId: null,
  });
});
test("given a workspace guest who remains project admin, commercial writes remain denied", async () => {
  const { t, owner, workspaceId, opportunityId, projectId, userId } = await commercialJourney();
  await owner.mutation(api.commercial.opportunities.transition, { workspaceId, opportunityId, stage: "won" });
  const member = await t.run((ctx) =>
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .unique()
  );
  await t.run((ctx) => ctx.db.patch(member!._id, { role: "guest" }));
  await expect(
    owner.mutation(api.commercial.delivery.start, {
      workspaceId,
      opportunityId,
      target: { kind: "existing", projectId },
    })
  ).rejects.toThrow("access");
  await expect(owner.mutation(api.commercial.delivery.saveProfile, { projectId, data: profileData })).rejects.toThrow(
    "access"
  );
});
