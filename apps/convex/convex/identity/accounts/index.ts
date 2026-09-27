import { paginationOptsValidator } from "convex/server";
import { query } from "../../_generated/server";
import { requireIdentity } from "../session";
import { pageBudget } from "../../commercial/validation";
import { mailConfiguration } from "../mail/config";
import { oauthConfigurations, providerNames } from "../oauth/config";
const names: Record<string, string> = { password: "Password", "summon-magic": "Email code", ...providerNames };
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const configured = new Set<string>(oauthConfigurations(process.env).map(({ id }) => id));
    if (mailConfiguration(process.env)) configured.add("summon-magic");
    const result = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...result,
      page: result.page.map((account) => ({
        id: account._id,
        provider: account.provider,
        name: names[account.provider] ?? "Other sign-in provider",
        connectedAt: account._creationTime,
        configuredForSignIn:
          account.provider === "password" ? Boolean(account.secret) : configured.has(account.provider),
      })),
    };
  },
});
