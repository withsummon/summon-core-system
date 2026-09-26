import { query } from "../_generated/server";
import { requireUser } from "./access";

// A user may share this ID for an explicit administrator-managed membership grant.
export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { id: user._id, name: user.name ?? null, email: user.email ?? null };
  },
});
