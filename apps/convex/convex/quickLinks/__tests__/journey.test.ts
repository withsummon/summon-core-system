import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
test("own links preserve nullable title, URL spelling, opaque JSON and partial updates", async () => {
  const f = await workspaceJourney();
  const metadata = { nested: [{ icon: "note", enabled: true }, null, 2], label: "opaque" };
  const linkId = await f.owner.mutation(api.quickLinks.index.create, {
    workspaceId: f.workspaceId,
    url: "example.com/path",
    metadata,
  });
  const link = await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId });
  expect(link).toMatchObject({ url: "http://example.com/path", title: null, metadata, ownerId: f.userId });
  await f.owner.mutation(api.quickLinks.index.update, {
    workspaceId: f.workspaceId,
    linkId,
    expectedUpdatedAt: link.updatedAt,
    title: "  Reference  ",
  });
  const updated = await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId });
  expect(updated).toMatchObject({ title: "Reference", metadata, url: link.url });
  await f.owner.mutation(api.quickLinks.index.update, {
    workspaceId: f.workspaceId,
    linkId,
    expectedUpdatedAt: updated.updatedAt,
    title: null,
    metadata: ["arbitrary JSON shape"],
  });
  expect((await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId })).metadata).toEqual([
    "arbitrary JSON shape",
  ]);
});
test("guest manages own links; administrator cannot read/change/delete them; revocation gates all endpoints", async () => {
  const f = await workspaceJourney();
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  const guest = await signedIn(f.t, guestId);
  const linkId = await guest.mutation(api.quickLinks.index.create, {
    workspaceId: f.workspaceId,
    url: "https://example.com",
  });
  const row = await guest.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId });
  expect((await f.owner.query(api.quickLinks.index.list, { workspaceId: f.workspaceId, paginationOpts })).page).toEqual(
    []
  );
  await expect(f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId })).rejects.toThrow(
    "not found"
  );
  await expect(
    f.owner.mutation(api.quickLinks.index.update, {
      workspaceId: f.workspaceId,
      linkId,
      expectedUpdatedAt: row.updatedAt,
      title: "Denied",
    })
  ).rejects.toThrow("not found");
  await expect(
    f.owner.mutation(api.quickLinks.index.remove, {
      workspaceId: f.workspaceId,
      linkId,
      expectedUpdatedAt: row.updatedAt,
    })
  ).rejects.toThrow("not found");
  await guest.mutation(api.quickLinks.index.update, {
    workspaceId: f.workspaceId,
    linkId,
    expectedUpdatedAt: row.updatedAt,
    title: "Guest edit",
  });
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: guestId });
  await expect(guest.query(api.quickLinks.index.list, { workspaceId: f.workspaceId, paginationOpts })).rejects.toThrow(
    "access"
  );
  await expect(guest.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId })).rejects.toThrow("access");
  await expect(
    guest.mutation(api.quickLinks.index.create, { workspaceId: f.workspaceId, url: "example.org" })
  ).rejects.toThrow("access");
  await expect(
    guest.mutation(api.quickLinks.index.remove, {
      workspaceId: f.workspaceId,
      linkId,
      expectedUpdatedAt: row.updatedAt,
    })
  ).rejects.toThrow("access");
});
test("exact URL uniqueness is scoped to owner/workspace and soft deletion releases it", async () => {
  const f = await workspaceJourney();
  const data = { workspaceId: f.workspaceId, url: "https://example.com" };
  const linkId = await f.owner.mutation(api.quickLinks.index.create, data);
  await expect(f.owner.mutation(api.quickLinks.index.create, data)).rejects.toThrow("already exists");
  const otherId = await f.owner.mutation(api.quickLinks.index.create, { ...data, url: "https://example.org" });
  const other = await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId: otherId });
  await expect(
    f.owner.mutation(api.quickLinks.index.update, { ...data, linkId: otherId, expectedUpdatedAt: other.updatedAt })
  ).rejects.toThrow("already exists");
  const row = await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId });
  await f.owner.mutation(api.quickLinks.index.remove, {
    workspaceId: f.workspaceId,
    linkId,
    expectedUpdatedAt: row.updatedAt,
  });
  await expect(f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId })).rejects.toThrow(
    "not found"
  );
  expect(await f.owner.mutation(api.quickLinks.index.create, data)).not.toBe(linkId);
  const workspaceId = await f.owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
  expect(await f.owner.mutation(api.quickLinks.index.create, { workspaceId, url: data.url })).toBeTruthy();
});
test("CAS is monotonic under a frozen clock; bounded pagination is newest-first and excludes deleted rows", async () => {
  const f = await workspaceJourney();
  const a = await f.owner.mutation(api.quickLinks.index.create, { workspaceId: f.workspaceId, url: "a.example.com" });
  const first = await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId: a });
  vi.useFakeTimers();
  vi.setSystemTime(first.updatedAt);
  try {
    await f.owner.mutation(api.quickLinks.index.update, {
      workspaceId: f.workspaceId,
      linkId: a,
      expectedUpdatedAt: first.updatedAt,
      title: "Changed",
    });
    expect((await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId: a })).updatedAt).toBe(
      first.updatedAt + 1
    );
    await expect(
      f.owner.mutation(api.quickLinks.index.remove, {
        workspaceId: f.workspaceId,
        linkId: a,
        expectedUpdatedAt: first.updatedAt,
      })
    ).rejects.toThrow("changed");
  } finally {
    vi.useRealTimers();
  }
  const b = await f.owner.mutation(api.quickLinks.index.create, { workspaceId: f.workspaceId, url: "b.example.com" });
  const page = await f.owner.query(api.quickLinks.index.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(page.page.map((row) => row._id)).toEqual([b]);
  expect(page.isDone).toBe(false);
  const next = await f.owner.query(api.quickLinks.index.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: page.continueCursor, numItems: 1 },
  });
  expect(next.page.map((row) => row._id)).toEqual([a]);
  await expect(
    f.owner.query(api.quickLinks.index.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 101 },
    })
  ).rejects.toThrow("Page size");
});
test.each([
  "javascript:alert(1)",
  "data:text/html,test",
  "",
  "https://bad host.com",
  "https://example.com/has space",
  "https://bad_label.example.com",
  "https://-bad.example.com",
  "https://example.c",
  "http://127.1",
])("URL validation rejects %s without a server fetch", async (url) => {
  const f = await workspaceJourney();
  await expect(f.owner.mutation(api.quickLinks.index.create, { workspaceId: f.workspaceId, url })).rejects.toThrow(
    "URL"
  );
});
test("non-JSON Convex metadata and null are rejected, while empty string and JSON scalars are retained", async () => {
  const f = await workspaceJourney();
  await expect(
    f.owner.mutation(api.quickLinks.index.create, { workspaceId: f.workspaceId, url: "example.com", metadata: null })
  ).rejects.toThrow("JSON");
  await expect(
    f.owner.mutation(api.quickLinks.index.create, { workspaceId: f.workspaceId, url: "example.com", metadata: 123n })
  ).rejects.toThrow("JSON");
  const linkId = await f.owner.mutation(api.quickLinks.index.create, {
    workspaceId: f.workspaceId,
    url: "example.com",
    title: "",
    metadata: false,
  });
  expect(await f.owner.query(api.quickLinks.index.get, { workspaceId: f.workspaceId, linkId })).toMatchObject({
    title: "",
    metadata: false,
  });
});
