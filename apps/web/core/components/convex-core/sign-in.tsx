import { TranslationProvider } from "@plane/i18n";
import { PasswordFields } from "@/components/account/auth-forms/password-fields";
import { newPasswordError } from "@/components/account/auth-forms/password-validation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { authFlowEnabled, type Flow } from "./auth-policy";
const presentation: Record<
  Flow,
  {
    title: string;
    submit: string;
    provider: "password" | "summon-magic";
    verification: boolean;
    mail: boolean;
    password: { name: string; label: string; autoComplete: string } | null;
    notice: string | null;
  }
> = {
  magic: {
    title: "Sign in with email",
    submit: "Send sign-in code",
    provider: "summon-magic",
    verification: false,
    mail: true,
    password: null,
    notice: null,
  },
  "magic-verification": {
    title: "Enter your sign-in code",
    submit: "Sign in",
    provider: "summon-magic",
    verification: true,
    mail: true,
    password: null,
    notice: "Paste the sign-in code sent to your email. It expires in 10 minutes.",
  },
  signIn: {
    title: "Welcome back",
    submit: "Sign in",
    provider: "password",
    verification: false,
    mail: false,
    password: { name: "password", label: "Password", autoComplete: "current-password" },
    notice: null,
  },
  signUp: {
    title: "Create your account",
    submit: "Create account",
    provider: "password",
    verification: false,
    mail: false,
    password: { name: "password", label: "Password", autoComplete: "new-password" },
    notice: null,
  },
  reset: {
    title: "Reset your password",
    submit: "Request reset code",
    provider: "password",
    verification: false,
    mail: true,
    password: null,
    notice: null,
  },
  "reset-verification": {
    title: "Choose a new password",
    submit: "Reset password",
    provider: "password",
    verification: true,
    mail: true,
    password: { name: "newPassword", label: "New password", autoComplete: "new-password" },
    notice: "If an account matches this email and delivery is available, a reset code has been sent. Paste it below.",
  },
  "email-verification": {
    title: "Verify your email",
    submit: "Verify email",
    provider: "password",
    verification: true,
    mail: true,
    password: null,
    notice: "Paste the verification code from your email. It expires in 15 minutes.",
  },
};
export function SignIn() {
  return (
    <TranslationProvider>
      <SignInForm />
    </TranslationProvider>
  );
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const available = useQuery(api.identity.mail.availability.get, {});
  const providers = useQuery(api.identity.oauth.availability.list, {});
  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const form = presentation[flow];
  const enabled = available !== undefined && authFlowEnabled(flow, available);
  const loading = available === undefined || providers === undefined;
  const hasMethod = available?.passwordSignIn || available?.magicCode || (providers?.length ?? 0) > 0;
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-subtle-1 bg-surface-1 p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!enabled || pending) return;
          if (flow === "signUp") {
            const validation = newPasswordError(signupPassword, confirmation);
            if (validation) {
              setError(
                validation === "mismatch"
                  ? "Passwords do not match."
                  : "Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character."
              );
              return;
            }
          }
          setPending(true);
          setError("");
          const data = new FormData(event.currentTarget);
          try {
            const result = await signIn(form.provider, data);
            if (flow === "magic") setFlow("magic-verification");
            else if (flow === "reset") setFlow("reset-verification");
            else if (!result.signingIn && available?.emailVerification && (flow === "signIn" || flow === "signUp"))
              setFlow("email-verification");
            else if (!result.signingIn && form.verification)
              setError("This code is invalid or expired. Request another code.");
          } catch {
            setError(
              form.mail
                ? "This request could not be completed. Check your code and try again."
                : "Could not sign in. Check your email and password, or try again."
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <p className="text-sm mb-2 text-secondary">Summon Core</p>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
        </div>
        {loading && <p role="status">Loading sign-in options…</p>}
        {!loading && !hasMethod && (
          <p role="status">No authentication methods are available. Contact your administrator.</p>
        )}
        {enabled && form.notice && (
          <p role="status" className="text-14 text-secondary">
            {form.notice}
          </p>
        )}
        {enabled && (
          <fieldset disabled={pending} className="space-y-5">
            <SummonField label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={form.verification}
                required
              />
            </SummonField>
            {form.verification && (
              <SummonField label="Verification code">
                <Input name="code" autoComplete="one-time-code" required maxLength={100} />
              </SummonField>
            )}
            {flow === "signUp" ? (
              <PasswordFields
                confirm
                password={signupPassword}
                confirmation={confirmation}
                onPasswordChange={setSignupPassword}
                onConfirmationChange={setConfirmation}
              />
            ) : (
              form.password && (
                <SummonField label={form.password.label}>
                  <Input
                    key={flow}
                    name={form.password.name}
                    type="password"
                    autoComplete={form.password.autoComplete}
                    minLength={8}
                    required
                  />
                </SummonField>
              )
            )}
            <input type="hidden" name="flow" value={flow} />
            <Button type="submit" loading={pending} disabled={pending}>
              {form.submit}
            </Button>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger-primary">
            {error}
          </p>
        )}
        {(!enabled || flow === "signIn" || flow === "signUp") &&
          providers?.map((provider) => (
            <Button
              key={provider.id}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await signIn(provider.id);
                } catch {
                  setError(`Could not connect to ${provider.name}. Try again.`);
                } finally {
                  setPending(false);
                }
              }}
            >
              Continue with {provider.name}
            </Button>
          ))}
        {(flow === "signIn" || !enabled) && available?.magicCode && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setFlow("magic");
              setError("");
            }}
          >
            Sign in with an email code
          </Button>
        )}
        {flow === "signIn" && available?.passwordReset && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setFlow("reset");
              setError("");
            }}
          >
            Forgot password?
          </Button>
        )}
        {available?.passwordSignIn && !available.passwordReset && (
          <p className="text-12 text-secondary">
            Password reset is unavailable: account email delivery is not configured.
          </p>
        )}
        {(available?.passwordSignIn || flow !== "signIn") && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setSignupPassword("");
              setConfirmation("");
              setError("");
            }}
          >
            {flow === "signIn" ? "Create an account" : "Back to sign in"}
          </Button>
        )}
      </form>
    </div>
  );
}
