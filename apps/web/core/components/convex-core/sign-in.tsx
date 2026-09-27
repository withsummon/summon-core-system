import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
type Flow = "signIn" | "signUp" | "reset" | "reset-verification" | "email-verification";
const titles: Record<Flow, string> = {
  signIn: "Welcome back",
  signUp: "Create your account",
  reset: "Reset your password",
  "reset-verification": "Choose a new password",
  "email-verification": "Verify your email",
};
export function SignIn() {
  const { signIn } = useAuthActions();
  const available = useQuery(api.identity.mail.availability.get, {});
  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const verification = flow === "reset-verification" || flow === "email-verification";
  const mailFlow = flow === "reset" || verification;
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-subtle-1 bg-surface-1 p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          const data = new FormData(event.currentTarget);
          try {
            const result = await signIn("password", data);
            if (flow === "reset") setFlow("reset-verification");
            else if (!result.signingIn && available?.emailVerification && (flow === "signIn" || flow === "signUp"))
              setFlow("email-verification");
            else if (!result.signingIn && verification)
              setError("This code is invalid or expired. Request another code.");
          } catch {
            setError(
              mailFlow
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
          <h1 className="text-2xl font-semibold">{titles[flow]}</h1>
        </div>
        {flow === "reset-verification" && (
          <p role="status" className="text-14 text-secondary">
            If an account matches this email and delivery is available, a reset code has been sent. Paste it below.
          </p>
        )}
        {flow === "email-verification" && (
          <p role="status" className="text-14 text-secondary">
            Paste the verification code from your email. It expires in 15 minutes.
          </p>
        )}
        <fieldset disabled={pending} className="space-y-5">
          <SummonField label="Email">
            <Input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              readOnly={verification}
              required
            />
          </SummonField>
          {verification && (
            <SummonField label="Verification code">
              <Input name="code" autoComplete="one-time-code" required maxLength={100} />
            </SummonField>
          )}
          {flow !== "reset" && flow !== "email-verification" && (
            <SummonField label={flow === "reset-verification" ? "New password" : "Password"}>
              <Input
                key={flow}
                name={flow === "reset-verification" ? "newPassword" : "password"}
                type="password"
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </SummonField>
          )}
          <input type="hidden" name="flow" value={flow} />
          <Button
            type="submit"
            loading={pending}
            disabled={available === undefined || (mailFlow && !available.passwordReset)}
          >
            {flow === "reset"
              ? "Request reset code"
              : flow === "reset-verification"
                ? "Reset password"
                : flow === "email-verification"
                  ? "Verify email"
                  : flow === "signIn"
                    ? "Sign in"
                    : "Create account"}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger-primary">
            {error}
          </p>
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
        {available && !available.passwordReset && (
          <p className="text-12 text-secondary">
            Password reset is unavailable: account email delivery is not configured.
          </p>
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError("");
          }}
        >
          {flow === "signIn" ? "Create an account" : "Back to sign in"}
        </Button>
      </form>
    </div>
  );
}
