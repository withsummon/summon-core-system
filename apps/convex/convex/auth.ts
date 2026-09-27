import { createOrUpdateUser } from "./identity/user_owner";
import { requireUnrestrictedAccount } from "./identity/deactivation/access";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { signInPolicy } from "./identity/signin_policy";
import { verificationEmail } from "./identity/mail/provider";
import { oauthProviders } from "./identity/oauth/providers";
import { validatePassword } from "./identity/password/policy";
const policy = signInPolicy(process.env);
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    createOrUpdateUser,
    beforeSessionCreation: async (ctx, { userId }) => {
      await requireUnrestrictedAccount(ctx, userId);
    },
  },
  providers: [
    ...(policy.password
      ? [
          Password({
            validatePasswordRequirements: validatePassword,
            ...(policy.passwordReset ? { reset: verificationEmail("reset"), verify: verificationEmail("verify") } : {}),
          }),
        ]
      : []),
    ...(policy.magic ? [verificationEmail("magic")] : []),
    ...oauthProviders(process.env),
  ],
});
