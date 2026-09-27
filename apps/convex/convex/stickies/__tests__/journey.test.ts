import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
async function fixture() {
  const f = await workspaceJourney();
  const stickyId = await f.owner.mutation(api.stickies.index.create, {
    workspaceId: f.workspaceId,
    html: "<p>Private content</p>",
  });
  return { ...f, stickyId };
}
async function person(f: Awaited<ReturnType<typeof fixture>>, role: "admin" | "guest") {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: role }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
  return { userId, user: f.t.withIdentity({ subject: userId }) };
}
test("guests own private stickies; administrators and revoked members cannot read or mutate another owner", async () => {
  const f = await fixture();
  const guest = await person(f, "guest");
  const admin = await person(f, "admin");
  const stickyId = await guest.user.mutation(api.stickies.index.create, {
    workspaceId: f.workspaceId,
    name: null,
    html: "<p>Guest private</p>",
  });
  const row = await guest.user.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId });
  expect(row.ownerId).toBe(guest.userId);
  expect(
    (
      await guest.user.query(api.stickies.index.list, {
        workspaceId: f.workspaceId,
        deleted: false,
        query: "",
        paginationOpts,
      })
    ).page.map((s) => s._id)
  ).toEqual([stickyId]);
  await expect(admin.user.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId })).rejects.toThrow(
    "not found"
  );
  await expect(
    f.owner.mutation(api.stickies.index.remove, {
      workspaceId: f.workspaceId,
      stickyId,
      expectedUpdatedAt: row.updatedAt,
    })
  ).rejects.toThrow("not found");
  await guest.user.mutation(api.stickies.index.update, {
    workspaceId: f.workspaceId,
    stickyId,
    expectedUpdatedAt: row.updatedAt,
    name: "Mine",
  });
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: guest.userId });
  await expect(guest.user.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId })).rejects.toThrow(
    "access"
  );
  await expect(
    guest.user.query(api.stickies.index.list, { workspaceId: f.workspaceId, deleted: false, query: "", paginationOpts })
  ).rejects.toThrow("access");
  await expect(guest.user.mutation(api.stickies.index.create, { workspaceId: f.workspaceId })).rejects.toThrow(
    "access"
  );
});
test("sanitized rich HTML owns text search while opaque JSON/binary and appearance roundtrip independently", async () => {
  const f = await fixture();
  const bytes = new Uint8Array([0, 5, 7, 255]).buffer;
  const stickyId = await f.owner.mutation(api.stickies.index.create, {
    workspaceId: f.workspaceId,
    name: null,
    html: "<p>Hello <strong>world</strong> &amp; friends</p><script>secret()</script>",
    editorJson: { type: "doc", content: [] },
    editorBinary: bytes,
    color: "#ffeeaa",
    backgroundColor: null,
    logoProps: { emoji: "📌" },
  });
  let row = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId });
  expect(row.html).toContain("<strong>world</strong>");
  expect(row.html).not.toContain("script");
  expect(row.description).toBe("Hello world & friends");
  expect(row.editorBinary).toEqual(bytes);
  expect(row.name).toBeNull();
  await f.owner.mutation(api.stickies.index.update, {
    workspaceId: f.workspaceId,
    stickyId,
    expectedUpdatedAt: row.updatedAt,
    html: "<p>New body</p>",
    backgroundColor: "#fff",
  });
  row = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId });
  expect(row.editorJson).toEqual({ type: "doc", content: [] });
  expect(row.editorBinary).toEqual(bytes);
  expect(row.logoProps).toEqual({ emoji: "📌" });
  expect(row.color).toBe("#ffeeaa");
  const result = await f.owner.query(api.stickies.index.list, {
    workspaceId: f.workspaceId,
    deleted: false,
    query: "NEW BODY",
    paginationOpts,
  });
  expect(result.page.map((s) => s._id)).toEqual([stickyId]);
});
test("order is persisted, sparse search pages continue, and same-order rows have stable index tie-breaking", async () => {
  const f = await fixture();
  const newer = await f.owner.mutation(api.stickies.index.create, {
    workspaceId: f.workspaceId,
    html: "<p>No match</p>",
  });
  const args = {
    workspaceId: f.workspaceId,
    deleted: false,
    query: "Private",
    paginationOpts: { cursor: null, numItems: 1 },
  };
  const first = await f.owner.query(api.stickies.index.list, args);
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await f.owner.query(api.stickies.index.list, {
    ...args,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(next.page.map((s) => s._id)).toEqual([f.stickyId]);
  let row = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId: f.stickyId });
  await f.owner.mutation(api.stickies.index.reorder, {
    workspaceId: f.workspaceId,
    stickyId: f.stickyId,
    expectedUpdatedAt: row.updatedAt,
    sortOrder: 999999,
  });
  const ordered = await f.owner.query(api.stickies.index.list, {
    workspaceId: f.workspaceId,
    deleted: false,
    query: "",
    paginationOpts,
  });
  expect(ordered.page.map((s) => s._id)).toEqual([f.stickyId, newer]);
  row = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId: newer });
  await f.owner.mutation(api.stickies.index.reorder, {
    workspaceId: f.workspaceId,
    stickyId: newer,
    expectedUpdatedAt: row.updatedAt,
    sortOrder: 999999,
  });
  const tied = await f.owner.query(api.stickies.index.list, {
    workspaceId: f.workspaceId,
    deleted: false,
    query: "",
    paginationOpts,
  });
  const repeated = await f.owner.query(api.stickies.index.list, {
    workspaceId: f.workspaceId,
    deleted: false,
    query: "",
    paginationOpts,
  });
  expect(tied.page.map((s) => s._id)).toEqual(repeated.page.map((s) => s._id));
  expect(tied.page).toHaveLength(2);
});
test("soft removal and recovery retain rich content/order; stale same-clock lifecycle and edit requests fail", async () => {
  vi.useFakeTimers();
  try {
    const f = await fixture();
    const row = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId: f.stickyId });
    const args = { workspaceId: f.workspaceId, stickyId: f.stickyId, expectedUpdatedAt: row.updatedAt };
    await f.owner.mutation(api.stickies.index.update, { ...args, name: "Edited" });
    await expect(f.owner.mutation(api.stickies.index.reorder, { ...args, sortOrder: 3 })).rejects.toThrow("changed");
    await expect(f.owner.mutation(api.stickies.index.remove, args)).rejects.toThrow("changed");
    const fresh = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId: f.stickyId });
    await f.owner.mutation(api.stickies.index.remove, { ...args, expectedUpdatedAt: fresh.updatedAt });
    expect(
      (
        await f.owner.query(api.stickies.index.list, {
          workspaceId: f.workspaceId,
          deleted: false,
          query: "",
          paginationOpts,
        })
      ).page
    ).toEqual([]);
    const trash = await f.owner.query(api.stickies.index.list, {
      workspaceId: f.workspaceId,
      deleted: true,
      query: "",
      paginationOpts,
    });
    expect(trash.page).toHaveLength(1);
    await expect(
      f.owner.mutation(api.stickies.index.update, { ...args, expectedUpdatedAt: trash.page[0].updatedAt, html: "Lost" })
    ).rejects.toThrow("not found");
    await f.owner.mutation(api.stickies.index.restore, { ...args, expectedUpdatedAt: trash.page[0].updatedAt });
    const restored = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId: f.stickyId });
    expect(restored.html).toBe(row.html);
    expect(restored.sortOrder).toBe(row.sortOrder);
    expect(restored.name).toBe("Edited");
    await expect(
      f.owner.mutation(api.stickies.index.restore, { ...args, expectedUpdatedAt: restored.updatedAt })
    ).rejects.toThrow("not in Trash");
  } finally {
    vi.useRealTimers();
  }
});
test("bounded payload/order validation rejects invalid writes and foreign-workspace IDs", async () => {
  const f = await fixture();
  const row = await f.owner.query(api.stickies.index.get, { workspaceId: f.workspaceId, stickyId: f.stickyId });
  const args = { workspaceId: f.workspaceId, stickyId: f.stickyId, expectedUpdatedAt: row.updatedAt };
  await expect(f.owner.mutation(api.stickies.index.reorder, { ...args, sortOrder: Infinity })).rejects.toThrow(
    "finite"
  );
  await expect(
    f.owner.mutation(api.stickies.index.update, { ...args, editorJson: { bad: BigInt(3) } })
  ).rejects.toThrow("JSON");
  await expect(
    f.owner.mutation(api.stickies.index.create, { workspaceId: f.workspaceId, logoProps: { huge: "x".repeat(10001) } })
  ).rejects.toThrow("Logo");
  await expect(
    f.owner.mutation(api.stickies.index.update, { ...args, editorBinary: new ArrayBuffer(524289) })
  ).rejects.toThrow("512 KiB");
  await expect(f.owner.mutation(api.stickies.index.update, { ...args, html: "x".repeat(100001) })).rejects.toThrow(
    "100,000"
  );
  const other = await f.owner.mutation(api.workspaces.index.create, { name: "Other", slug: "sticky-other" });
  await expect(f.owner.query(api.stickies.index.get, { workspaceId: other, stickyId: f.stickyId })).rejects.toThrow(
    "not found"
  );
  await expect(
    f.owner.query(api.stickies.index.list, {
      workspaceId: f.workspaceId,
      deleted: false,
      query: "",
      paginationOpts: { cursor: null, numItems: 101 },
    })
  ).rejects.toThrow();
});

test("raw sticky deep links normalize at the private owner and reject malformed or another owner's IDs", async () => {
  const f = await fixture();
  const admin = await person(f, "admin");
  expect(
    (await f.owner.query(api.stickies.index.resolve, { workspaceId: f.workspaceId, stickyId: String(f.stickyId) }))._id
  ).toBe(f.stickyId);
  await expect(
    f.owner.query(api.stickies.index.resolve, { workspaceId: f.workspaceId, stickyId: "not-an-id" })
  ).rejects.toThrow("not found");
  await expect(
    admin.user.query(api.stickies.index.resolve, { workspaceId: f.workspaceId, stickyId: String(f.stickyId) })
  ).rejects.toThrow("not found");
});
