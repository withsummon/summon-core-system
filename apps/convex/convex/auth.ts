import { requireUnrestrictedAccount } from "./identity/deactivation/access";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { mailConfiguration } from "./identity/mail/config";
import { verificationEmail } from "./identity/mail/provider";
import { oauthProviders } from "./identity/oauth/providers";
import { validatePassword } from "./identity/password/policy";
const configured = mailConfiguration(process.env) !== null;
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    beforeSessionCreation: async (ctx, { userId }) => {
      await requireUnrestrictedAccount(ctx, userId);
    },
  },
  providers: [
    Password({
      validatePasswordRequirements: validatePassword,
      ...(configured ? { reset: verificationEmail("reset"), verify: verificationEmail("verify") } : {}),
    }),
    ...(configured ? [verificationEmail("magic")] : []),
    ...oauthProviders(process.env),
  ],
});
