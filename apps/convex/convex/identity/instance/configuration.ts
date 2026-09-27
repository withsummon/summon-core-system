import { query } from "../../_generated/server";
import { requireInstanceAdmin } from "./access";
import { mailConfiguration } from "../mail/config";
import { oauthConfigurations } from "../oauth/config";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    return {
      initializedAt: instance.initializedAt,
      passwordSignIn: true,
      mailConfigured: mailConfiguration(process.env) !== null,
      oauthProviders: oauthConfigurations(process.env).map((provider) => provider.id),
    };
  },
});
