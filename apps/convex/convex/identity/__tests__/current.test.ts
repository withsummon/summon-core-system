import { signedIn } from "../../../test-support/session";
import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

describe("current identity", () => {
  test("given authenticated users, each receives only their own shareable identity fields", async () => {
    const { t, owner, userId } = await workspaceJourney();
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Other", email: "other@example.test", phone: "+620000000" })
    );
    const other = await signedIn(t, otherId);
    expect(await owner.query(api.identity.index.current, {})).toEqual({ id: userId, name: "Owner", email: null });
    expect(await other.query(api.identity.index.current, {})).toEqual({
      id: otherId,
      name: "Other",
      email: "other@example.test",
    });
  });
  test("given anonymous access, current identity is not disclosed", async () => {
    const { t } = await workspaceJourney();
    await expect(t.query(api.identity.index.current, {})).rejects.toThrow("Sign in");
  });
  test("given a removed user, a previous identity cannot retrieve profile data", async () => {
    const { t, owner, userId } = await workspaceJourney();
    await t.run((ctx) => ctx.db.delete(userId));
    await expect(owner.query(api.identity.index.current, {})).rejects.toThrow("Sign in");
  });
});
