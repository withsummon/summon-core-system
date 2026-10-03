import { signupPolicy } from "../signup_policy";
import { query } from "../../_generated/server";
import { signInPolicy } from "../signin_policy";
export const get = query({
  args: {},
  handler: () => {
    const policy = signInPolicy(process.env);
    return {
      ...signupPolicy(),
      passwordSignIn: policy.password,
      passwordReset: policy.passwordReset,
      magicCode: policy.magic,
      emailVerification: policy.emailVerification,
      unavailableReason:
        policy.passwordReset || policy.magic
          ? null
          : "Account email sign-in and recovery are unavailable under the current operator configuration.",
    };
  },
});
