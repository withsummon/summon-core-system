import { query } from "../../_generated/server";
import { mailConfiguration } from "./config";
export const get = query({
  args: {},
  handler: () => {
    const configured = mailConfiguration(process.env) !== null;
    return {
      passwordReset: configured,
      emailVerification: configured,
      unavailableReason: configured ? null : "Account email delivery is not configured.",
    };
  },
});
