import { query } from "../../_generated/server";
import { oauthConfigurations, providerNames } from "./config";
import { currentAuthentication } from "../instance/authentication";
export const list = query({
  args: {},
  handler: async (ctx) => {
    const policy = await currentAuthentication(ctx);
    return oauthConfigurations(process.env)
      .filter(({ id }) => policy.providers[id])
      .map(({ id }) => ({ id, name: providerNames[id] }));
  },
});
