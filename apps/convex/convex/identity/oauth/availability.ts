import { query } from "../../_generated/server";
import { oauthConfigurations, providerNames } from "./config";
export const list = query({
  args: {},
  handler: () =>
    oauthConfigurations(process.env).map(({ id }) => ({
      id,
      name: providerNames[id],
    })),
});
