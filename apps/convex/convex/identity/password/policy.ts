import { ConvexError } from "convex/values";
import type { BetterAuthOptions, DBAdapter, RateLimit } from "better-auth/types";
import type { Id } from "../../_generated/dataModel";

export const passwordAttemptWindowMs = 60 * 60 * 1000;
const passwordAttemptsPerHour = 10;

// Shared by every current-password proof. The caller must return an expected
// denial, rather than throw, so this reservation commits on an invalid password.
export async function reservePasswordAttempt<Options extends BetterAuthOptions>(
  adapter: DBAdapter<Options>,
  userId: Id<"users">
) {
  const key = `password-proof:${userId}`;
  const where = [{ field: "key", value: key }];
  const existing = await adapter.findOne<RateLimit>({ model: "rateLimit", where });
  const now = Date.now();
  const count = existing
    ? Math.max(0, existing.count - ((now - existing.lastRequest) * passwordAttemptsPerHour) / passwordAttemptWindowMs)
    : 0;
  if (count + 1 > passwordAttemptsPerHour) return null;
  const update = { count: count + 1, lastRequest: now };
  if (existing) await adapter.updateMany({ model: "rateLimit", where, update });
  else await adapter.create<RateLimit>({ model: "rateLimit", data: { key, ...update } });
  return key;
}

export async function clearPasswordAttempts<Options extends BetterAuthOptions>(
  adapter: DBAdapter<Options>,
  key: string
) {
  await adapter.deleteMany({ model: "rateLimit", where: [{ field: "key", value: key }] });
}

export function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < 8 || password.length > 1024)
    throw new ConvexError("Use a password between 8 and 1024 characters.");
}
