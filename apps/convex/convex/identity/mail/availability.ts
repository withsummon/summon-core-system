import { query } from "../../_generated/server";
import { currentSignInPolicy } from "../signin_policy";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const policy = await currentSignInPolicy(ctx);
    return {
      signupEnabled: policy.signupEnabled,
      isSelfManaged: true,
      passwordSignIn: policy.password,
      passwordReset: policy.passwordReset,
      magicCode: policy.magic,
      emailVerification: policy.emailVerification,
      unavailableReason:
        policy.passwordReset || policy.magic
          ? null
          : "Account email sign-in and recovery are unavailable under the current instance configuration.",
    };
  },
});
