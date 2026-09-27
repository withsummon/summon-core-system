import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { mailConfiguration } from "./identity/mail/config";
import { verificationEmail } from "./identity/mail/provider";
import { oauthProviders } from "./identity/oauth/providers";
const configured = mailConfiguration(process.env) !== null;
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password(configured ? { reset: verificationEmail("reset"), verify: verificationEmail("verify") } : {}),
    ...oauthProviders(process.env),
  ],
});
