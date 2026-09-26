import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-subtle-1 bg-surface-1 p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          try {
            await signIn("password", data);
          } catch {
            setError(
              flow === "signIn"
                ? "Could not sign in. Check your email and password, then try again."
                : "Could not create your account. Try another email or sign in to your existing account."
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <p className="text-sm mb-2 text-secondary">Summon Core</p>
          <h1 className="text-2xl font-semibold">{flow === "signIn" ? "Welcome back" : "Create your account"}</h1>
        </div>
        <SummonField label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </SummonField>
        <SummonField label="Password">
          <Input
            name="password"
            type="password"
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </SummonField>
        <input type="hidden" name="flow" value={flow} />
        {error && (
          <p role="alert" className="text-sm text-danger-primary">
            {error}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {flow === "signIn" ? "Sign in" : "Create account"}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError("");
          }}
        >
          {flow === "signIn" ? "Create an account" : "Use an existing account"}
        </Button>
      </form>
    </div>
  );
}
