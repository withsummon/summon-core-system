import type { TestConvex } from "convex-test";
import type schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
// Tests authenticate through real canonical session rows; anonymous tests keep the original test client.
export async function signedIn(t: TestConvex<typeof schema>, userId: Id<"users">) {
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 30 * 24 * 60 * 60 * 1000 })
  );
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}
