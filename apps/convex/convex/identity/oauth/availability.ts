import { query } from "../../_generated/server";
import { currentOAuth } from "../instance/oauth";
import { providerNames } from "./config";
import { currentAuthentication } from "../instance/authentication";
export const list = query({
  args: {},
  handler: async (ctx) => {
    const policy = await currentAuthentication(ctx);
    return (await currentOAuth(ctx)).configurations
      .filter(({ id }) => policy.providers[id])
      .map(({ id }) => ({ id, name: providerNames[id] }));
  },
});
