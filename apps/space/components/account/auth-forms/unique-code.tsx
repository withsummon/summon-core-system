import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input, Spinner } from "@plane/ui";
import useTimer from "@/hooks/use-timer";

type Props = {
  email: string;
  disabled: boolean;
  pending: boolean;
  onEmailChange: () => void;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<boolean>;
};
export function AuthUniqueCodeForm({ email, disabled, pending, onEmailChange, onSubmit, onResend }: Props) {
  const [code, setCode] = useState("");
  const { timer, setTimer } = useTimer(0);
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && code) void onSubmit(code);
      }}
    >
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="code-email">
          Email
        </label>
        <div className="relative flex items-center rounded-md border border-subtle bg-surface-1">
          <Input
            id="code-email"
            type="email"
            value={email}
            disabled
            className="h-10 w-full border-0 disable-autofill-style placeholder:text-placeholder"
          />
          <button
            type="button"
            disabled={pending}
            onClick={onEmailChange}
            className="absolute right-3 text-13 text-accent-primary"
          >
            Change
          </button>
        </div>
      </div>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="space-y-1">
          <label className="text-13 font-medium text-tertiary" htmlFor="code">
            Unique code
          </label>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            className="h-10 w-full border border-subtle !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
          />
          <div className="flex w-full items-center justify-between px-1 pt-1 text-11">
            <p className="flex items-center gap-1 font-medium text-success-primary">
              <CircleCheck size={12} />
              Paste the code sent to your email
            </p>
            <button
              type="button"
              disabled={timer > 0}
              className="font-medium text-accent-secondary hover:text-accent-secondary disabled:text-placeholder"
              onClick={async () => {
                if (await onResend()) {
                  setCode("");
                  setTimer(5);
                }
              }}
            >
              {timer > 0 ? `Resend in ${timer}s` : "Resend"}
            </button>
          </div>
        </div>
        <Button type="submit" variant="primary" className="w-full" size="xl" disabled={!code}>
          {pending ? <Spinner height="20px" width="20px" /> : "Continue"}
        </Button>
      </fieldset>
    </form>
  );
}
