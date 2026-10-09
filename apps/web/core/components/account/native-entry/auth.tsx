import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useTheme } from "next-themes";
import { CircleCheck } from "lucide-react";
import { authClient } from "@/components/convex-core/provider";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { EAuthModes, EAuthSteps } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button, getButtonStyling } from "@plane/propel/button";
import { Input, OAuthOptions, Spinner } from "@plane/ui";
import giteaLogo from "@/app/assets/logos/gitea-logo.svg?url";
import GithubLightLogo from "@/app/assets/logos/github-black.png?url";
import GithubDarkLogo from "@/app/assets/logos/github-dark.svg?url";
import gitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
import googleLogo from "@/app/assets/logos/google-logo.svg?url";
import { AuthScreen } from "@/components/auth-screens/auth-screen";
import { AuthHeader } from "@/components/auth-screens/header";
import { AuthContainer } from "../auth-forms/auth-container";
import { AuthHeaderBase, Titles } from "../auth-forms/auth-header";
import { AuthBanner } from "../auth-forms/auth-banner";
import { AuthEmailForm } from "../auth-forms/email";
import { PasswordFields } from "../auth-forms/password-fields";
import { newPasswordError } from "../auth-forms/password-validation";
import { TermsAndConditions } from "../terms-and-conditions";

const providerLogos = { google: googleLogo, github: GithubLightLogo, gitlab: gitlabLogo, gitea: giteaLogo };

type EntryState =
  | { flow: "email" | "email-verification" | "magic-verification"; mode: EAuthModes }
  | { flow: "signIn" | "reset" | "reset-verification"; mode: EAuthModes.SIGN_IN }
  | { flow: "signUp"; mode: EAuthModes.SIGN_UP };

function authFlowEnabled(
  flow: EntryState["flow"],
  policy: FunctionReturnType<typeof api.identity.mail.availability.get> | undefined
): boolean {
  if (!policy) return false;
  switch (flow) {
    case "email":
      return policy.passwordSignIn || policy.magicCode;
    case "signIn":
    case "signUp":
      return policy.passwordSignIn;
    case "reset":
    case "reset-verification":
      return policy.passwordSignIn && policy.passwordReset;
    case "email-verification":
      return policy.passwordSignIn && policy.emailVerification;
    case "magic-verification":
      return policy.magicCode;
  }
}
export function NativeEntryAuth({
  initialState,
}: {
  initialState: { flow: "email"; mode: EAuthModes } | { flow: "reset"; mode: EAuthModes.SIGN_IN };
}) {
  const convex = useConvex();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const availability = useQuery(api.identity.mail.availability.get);
  const providers = useQuery(api.identity.oauth.availability.list);
  const [params] = useSearchParams();
  const [{ mode, flow }, setState] = useState<EntryState>(initialState);
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>("");
  const reset = () => {
    setState(initialState);
    setPassword("");
    setConfirmation("");
    setCode("");
    setError("");
  };
  const start = async (selectedEmail: string) => {
    if (pending) return;
    setError("");
    setPending(true);
    try {
      if (flow === "reset") {
        setEmail(selectedEmail);
        setState({ flow: "reset-verification", mode: EAuthModes.SIGN_IN });
        const result = await authClient.emailOtp.requestPasswordReset({ email: selectedEmail });
        if (result.error) setError(result.error.message);
        return;
      }
      const result = await convex.query(api.identity.entry.check, { email: selectedEmail });
      if (!result.existing && !result.canSignUp) {
        setError("Account creation is disabled. Contact your instance administrator.");
        return;
      }
      if (!result.method) {
        setError("Email authentication is unavailable. Choose a configured sign-in provider.");
        return;
      }
      setEmail(result.email);
      if (result.method === "magic") {
        setState({ flow: "magic-verification", mode: result.existing ? EAuthModes.SIGN_IN : EAuthModes.SIGN_UP });
        const sent = await authClient.emailOtp.sendVerificationOtp({
          email: result.email,
          type: "sign-in",
        });
        if (sent.error) setError(sent.error.message);
      } else {
        setState(
          result.existing ? { flow: "signIn", mode: EAuthModes.SIGN_IN } : { flow: "signUp", mode: EAuthModes.SIGN_UP }
        );
      }
    } catch {
      setError("Could not continue. Check your email and try again.");
    } finally {
      setPending(false);
    }
  };
  const enabled = authFlowEnabled(flow, availability);
  const createsPassword = ["signUp", "reset-verification"].includes(flow);
  const collectingEmail = ["email", "reset"].includes(flow);
  const needsCode = ["magic-verification", "email-verification", "reset-verification"].includes(flow);
  const recoveryParams = new URLSearchParams(params);
  recoveryParams.set("email", email);
  const recovering = ["reset", "reset-verification"].includes(flow);
  const formHeader = Titles[mode][EAuthSteps.EMAIL];
  const resend = async () => {
    if (pending || !enabled) return;
    setError("");
    setPending(true);
    try {
      let result;
      switch (flow) {
        case "magic-verification":
        case "email-verification":
          result = await authClient.emailOtp.sendVerificationOtp({
            email,
            type: flow === "magic-verification" ? "sign-in" : "email-verification",
          });
          break;
        case "reset-verification":
          result = await authClient.emailOtp.requestPasswordReset({ email });
          break;
        default:
          return;
      }
      if (result.error) setError(result.error.message);
      else setCode("");
    } catch {
      setError("Could not send a new code. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };
  const submit = async () => {
    if (pending || !enabled) return;
    setError("");
    if (createsPassword) {
      const invalid = newPasswordError(password, confirmation);
      if (invalid) {
        setError(
          invalid === "mismatch" ? "Passwords do not match." : "Your password does not meet the displayed requirements."
        );
        return;
      }
    }
    setPending(true);
    try {
      let result;
      switch (flow) {
        case "magic-verification":
          result = await authClient.signIn.emailOtp({ email, otp: code });
          break;
        case "email-verification": {
          const verified = await authClient.emailOtp.verifyEmail({ email, otp: code });
          if (verified.error) {
            setError(verified.error.message);
            return;
          }
          setCode("");
          setState({ flow: "signIn", mode: EAuthModes.SIGN_IN });
          result = await authClient.signIn.email({ email, password });
          break;
        }
        case "reset-verification":
          result = await authClient.emailOtp.resetPassword({ email, otp: code, password });
          if (!result.error) {
            setPassword("");
            setConfirmation("");
            setCode("");
            setState({ flow: "signIn", mode: EAuthModes.SIGN_IN });
          }
          break;
        case "signUp":
          result = await authClient.signUp.email({ email, password, name: "" });
          if (!result.error && !result.data.token) setState({ flow: "email-verification", mode: EAuthModes.SIGN_UP });
          break;
        case "signIn":
          result = await authClient.signIn.email({ email, password });
          if (result.error?.code === "EMAIL_NOT_VERIFIED")
            setState({ flow: "email-verification", mode: EAuthModes.SIGN_IN });
          break;
        default:
          return;
      }
      if (result.error) setError(result.error.message);
    } catch {
      setError("Authentication failed. Check your details and try again.");
    } finally {
      setPending(false);
    }
  };
  let content: ReactNode;
  if (availability === undefined || providers === undefined) {
    content = <p role="status">Loading sign-in options…</p>;
  } else if (!authFlowEnabled("email", availability) && providers.length === 0) {
    content = <p>No authentication methods available. Please contact your administrator.</p>;
  } else if (!enabled) {
    content = flow !== "email" && (
      <div role="status" className="space-y-3">
        <p>This sign-in method is no longer available.</p>
        <Link to={`/?${params}`} className={getButtonStyling("secondary", "sm")}>
          Choose another method
        </Link>
      </div>
    );
  } else if (collectingEmail) {
    content = <AuthEmailForm defaultEmail={email} onSubmit={({ email: value }) => start(value)} />;
  } else {
    content = (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1">
          <label htmlFor="entry-email" className="text-13 font-medium text-tertiary">
            Email
          </label>
          <div className="relative flex items-center rounded-md border border-strong bg-surface-1">
            <Input
              id="entry-email"
              type="email"
              value={email}
              disabled
              className="h-10 w-full border-0 disable-autofill-style placeholder:text-placeholder"
            />
            <button
              type="button"
              disabled={pending}
              onClick={reset}
              className="absolute right-3 text-13 text-accent-primary"
            >
              Change
            </button>
          </div>
        </div>
        {needsCode && (
          <div className="space-y-1">
            <label htmlFor="entry-code" className="text-13 font-medium text-tertiary">
              {t("auth.common.unique_code.label")}
            </label>
            <Input
              id="entry-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              className="h-10 w-full border border-strong !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
              required
            />
            <div className="flex w-full items-center justify-between px-1 pt-1 text-11">
              <p className="flex items-center gap-1 font-medium text-success-primary">
                <CircleCheck height={12} width={12} />
                {t("auth.common.unique_code.paste_code")}
              </p>
              <button
                type="button"
                onClick={() => void resend()}
                className="font-medium text-accent-secondary hover:text-accent-secondary disabled:text-placeholder"
              >
                {t("common.resend")}
              </button>
            </div>
          </div>
        )}
        {createsPassword ? (
          <PasswordFields
            confirm
            password={password}
            confirmation={confirmation}
            onPasswordChange={setPassword}
            onConfirmationChange={setConfirmation}
          />
        ) : flow === "signIn" ? (
          <PasswordFields
            confirm={false}
            password={password}
            onPasswordChange={setPassword}
            support={
              availability.passwordReset && (
                <Link to={`/accounts/forgot-password?${recoveryParams}`} className="text-13 text-accent-primary">
                  {t("auth.common.forgot_password")}
                </Link>
              )
            }
          />
        ) : null}
        <Button type="submit" variant="primary" className="w-full" size="xl" loading={pending} aria-busy={pending}>
          {pending ? <Spinner height="20px" width="20px" /> : t("common.continue")}
        </Button>
      </form>
    );
  }
  return (
    <AuthScreen
      header={
        <AuthHeader
          type={mode}
          enableSignUp={availability?.signupEnabled}
          pageTitle={recovering ? "Reset password" : undefined}
        />
      }
    >
      <AuthContainer>
        <AuthBanner message={error} handleBannerData={() => setError("")} />
        <AuthHeaderBase
          header={recovering ? "Reset password" : formHeader.header}
          subHeader={
            needsCode
              ? "Enter the secure code sent to your email."
              : flow === "reset"
                ? "Regain access to your account."
                : formHeader.subHeader
          }
        />
        <fieldset disabled={pending} aria-busy={pending} className="flex w-full min-w-0 flex-col gap-5">
          {content}
          {providers && (
            <OAuthOptions
              compact={["signIn", "signUp"].includes(flow)}
              showDivider={authFlowEnabled("email", availability)}
              options={providers.map((provider) => ({
                id: provider.id,
                text: `${t(mode === EAuthModes.SIGN_UP ? "Sign up" : "Sign in")} with ${provider.name}`,
                icon: (
                  <img
                    src={
                      provider.id === "github" && resolvedTheme === "dark" ? GithubDarkLogo : providerLogos[provider.id]
                    }
                    width={18}
                    height={18}
                    alt={`${provider.name} Logo`}
                  />
                ),
                onClick: async () => {
                  if (pending) return;
                  setPending(true);
                  setError("");
                  try {
                    const result = await authClient.signIn.oauth2({
                      providerId: provider.id,
                      callbackURL: window.location.href,
                    });
                    if (result.error) setError(result.error.message);
                  } catch {
                    setError(`Could not connect to ${provider.name}. Check your connection and try again.`);
                  } finally {
                    setPending(false);
                  }
                },
              }))}
            />
          )}
        </fieldset>
        {recovering && (
          <Link to={`/?${params}`} className={`w-full ${getButtonStyling("link", "lg")}`}>
            {t("auth.common.back_to_sign_in")}
          </Link>
        )}
        <TermsAndConditions authType={mode} />
      </AuthContainer>
    </AuthScreen>
  );
}
