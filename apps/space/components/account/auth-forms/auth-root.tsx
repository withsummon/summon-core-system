import { useState } from "react";
import { useTheme } from "next-themes";
import type { FunctionReturnType } from "convex/server";
import giteaLogo from "@/app/assets/logos/gitea-logo.svg?url";
import githubLightLogo from "@/app/assets/logos/github-black.png?url";
import githubDarkLogo from "@/app/assets/logos/github-dark.svg?url";
import gitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
import googleLogo from "@/app/assets/logos/google-logo.svg?url";
import { useSearchParams } from "react-router";
import { useConvex, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { OAuthOptions } from "@plane/ui";
import { authClient } from "@/app/providers";
import { EAuthModes } from "@/types/auth";
import { TermsAndConditions } from "../terms-and-conditions";
import { AuthBanner } from "./auth-banner";
import { AuthHeader } from "./auth-header";
import { AuthEmailForm } from "./email";
import { AuthPasswordForm } from "./password";
import { AuthUniqueCodeForm } from "./unique-code";

const providerLogos = {
  google: googleLogo,
  github: githubDarkLogo,
  gitlab: gitlabLogo,
  gitea: giteaLogo,
} satisfies Record<FunctionReturnType<typeof api.identity.oauth.availability.list>[number]["id"], string>;

export function AuthRoot() {
  const { resolvedTheme } = useTheme();
  const convex = useConvex();
  const [params] = useSearchParams();
  const availability = useQuery(api.identity.mail.availability.get);
  const providers = useQuery(api.identity.oauth.availability.list);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [mode, setMode] = useState(EAuthModes.SIGN_UP);
  const [flow, setFlow] = useState<"email" | "password" | "magic" | "verification">("email");
  const [error, setError] = useState<string>();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const entry = useQuery(api.identity.entry.check, flow === "email" ? "skip" : { email });
  const reset = () => {
    if (pending) return;
    setFlow("email");
    setPassword("");
    setError(undefined);
  };
  const sendCode = async () => {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: flow === "verification" ? "email-verification" : "sign-in",
    });
    if (result.error) throw new Error(result.error.message);
  };
  const resend = async () => {
    if (pending) return false;
    setPending(true);
    setError(undefined);
    try {
      await sendCode();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not send a new code. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  };
  const start = async (selectedEmail: string) => {
    setPending(true);
    setError(undefined);
    try {
      const result = await convex.query(api.identity.entry.check, { email: selectedEmail });
      setEmail(result.email);
      setMode(result.existing ? EAuthModes.SIGN_IN : EAuthModes.SIGN_UP);
      if (!result.existing && !result.canSignUp) {
        setError("Account creation is disabled. Contact your instance administrator.");
        return;
      }
      if (!result.method) {
        setError("Email sign-in is unavailable. Use an enabled provider.");
        return;
      }
      if (result.method === "magic") {
        const sent = await authClient.emailOtp.sendVerificationOtp({ email: result.email, type: "sign-in" });
        if (sent.error) {
          setError(sent.error.message);
          return;
        }
      }
      setFlow(result.method === "magic" ? "magic" : "password");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not check this account. Try again.");
    } finally {
      setPending(false);
    }
  };
  const submitPassword = async (value: string) => {
    setPending(true);
    setError(undefined);
    try {
      const result =
        mode === EAuthModes.SIGN_IN
          ? await authClient.signIn.email({ email, password: value })
          : await authClient.signUp.email({ email, password: value, name: "" });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (mode === EAuthModes.SIGN_UP && !result.data.token) {
        setPassword(value);
        setFlow("verification");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in. Try again.");
    } finally {
      setPending(false);
    }
  };
  const submitCode = async (otp: string) => {
    setPending(true);
    setError(undefined);
    try {
      if (flow === "verification") {
        const verified = await authClient.emailOtp.verifyEmail({ email, otp });
        if (verified.error) {
          setError(verified.error.message);
          return;
        }
        const signedIn = await authClient.signIn.email({ email, password });
        if (signedIn.error) setError(signedIn.error.message);
        else setPassword("");
      } else {
        const result = await authClient.signIn.emailOtp({ email, otp });
        if (result.error) setError(result.error.message);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not verify this code. Try again.");
    } finally {
      setPending(false);
    }
  };
  const magicEnabled = availability?.magicCode === true;
  const enabled =
    flow === "password"
      ? entry?.method === "password"
      : flow === "magic"
        ? magicEnabled
        : flow === "verification"
          ? availability?.emailVerification === true
          : true;
  return (
    <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
      <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
        {error && <AuthBanner message={error} onDismiss={() => setError(undefined)} />}
        <AuthHeader authMode={mode} />
        {providers && providers.length > 0 && (
          <fieldset disabled={pending}>
            <OAuthOptions
              compact={flow === "password"}
              options={providers.map((provider) => ({
                id: provider.id,
                icon: (
                  <img
                    src={
                      provider.id === "github" && resolvedTheme === "dark"
                        ? githubLightLogo
                        : providerLogos[provider.id]
                    }
                    height={18}
                    width={18}
                    alt={`${provider.name} logo`}
                  />
                ),
                text: `${mode === EAuthModes.SIGN_UP ? "Sign up" : "Sign in"} with ${provider.name}`,
                onClick: async () => {
                  if (pending) return;
                  setPending(true);
                  setError(undefined);
                  try {
                    const result = await authClient.signIn.oauth2({
                      providerId: provider.id,
                      callbackURL: window.location.href,
                    });
                    if (result.error) setError(result.error.message);
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : "Could not open this provider. Try again.");
                  } finally {
                    setPending(false);
                  }
                },
              }))}
            />
          </fieldset>
        )}
        {flow === "email" && <AuthEmailForm defaultEmail={email} disabled={pending} onSubmit={start} />}
        {flow === "password" && (
          <AuthPasswordForm
            email={email}
            mode={mode}
            disabled={pending || !enabled}
            pending={pending}
            magicEnabled={magicEnabled}
            onSubmit={submitPassword}
            onEmailChange={reset}
            onUseCode={async () => {
              if (await resend()) setFlow("magic");
            }}
          />
        )}
        {(flow === "magic" || flow === "verification") && (
          <AuthUniqueCodeForm
            email={email}
            disabled={pending || !enabled}
            pending={pending}
            onEmailChange={reset}
            onSubmit={submitCode}
            onResend={resend}
          />
        )}
        {flow !== "email" && !enabled && (
          <p role="status" className="text-13 text-secondary">
            This sign-in method is currently unavailable. Change email or use an enabled provider.
          </p>
        )}
        <TermsAndConditions isSignUp={mode === EAuthModes.SIGN_UP} />
      </div>
    </div>
  );
}
