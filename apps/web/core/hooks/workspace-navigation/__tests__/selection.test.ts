import assert from "node:assert/strict";
import test from "node:test";
import { selectWorkspaceAndNavigate } from "../selection.ts";

test("workspace selection persists only its ID before navigation", async () => {
  const events: string[] = [];
  let finish!: () => void;
  const pending = selectWorkspaceAndNavigate(
    { id: "workspace-a", slug: "team-a" },
    async (id) => {
      events.push(`select:${id}`);
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    (href) => {
      events.push(`navigate:${href}`);
    }
  );
  assert.deepEqual(events, ["select:workspace-a"]);
  finish();
  await pending;
  assert.deepEqual(events, ["select:workspace-a", "navigate:/team-a"]);
});
test("failed selection leaves the current route unchanged and propagates failure", async () => {
  await assert.rejects(
    selectWorkspaceAndNavigate(
      { id: "workspace-a", slug: "team-a" },
      async () => {
        throw new Error("Membership revoked");
      },
      () => assert.fail("Must not navigate after rejection")
    ),
    /Membership revoked/
  );
});
