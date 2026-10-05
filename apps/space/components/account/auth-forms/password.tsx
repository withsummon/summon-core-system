import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { E_PASSWORD_STRENGTH } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { Input, Spinner, PasswordStrengthIndicator } from "@plane/ui";
import { getPasswordStrength } from "@plane/utils";
import { EAuthModes } from "@/types/auth";

type Props = {
  email: string;
  mode: EAuthModes;
  disabled: boolean;
  pending: boolean;
  magicEnabled: boolean;
  onEmailChange: () => void;
  onSubmit: (password: string) => Promise<void>;
  onUseCode: () => Promise<void>;
};

export function AuthPasswordForm({
  email,
  mode,
  disabled,
  pending,
  magicEnabled,
  onEmailChange,
  onSubmit,
  onUseCode,
}: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [focused, setFocused] = useState(false);
  const creating = mode === EAuthModes.SIGN_UP;
  const valid =
    password.length > 0 &&
    (!creating || (getPasswordStrength(password) === E_PASSWORD_STRENGTH.STRENGTH_VALID && password === confirmation));
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && valid) void onSubmit(password);
      }}
    >
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="password-email">
          Email
        </label>
        <div className="relative flex items-center rounded-md border border-subtle bg-surface-1">
          <Input
            id="password-email"
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
          <label className="text-13 font-medium text-tertiary" htmlFor="password">
            {creating ? "Set a password" : "Password"}
          </label>
          <div className="relative flex items-center rounded-md bg-surface-1">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Enter password"
              autoComplete={creating ? "new-password" : "current-password"}
              className="h-10 w-full border border-subtle !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
            />
            <button
              type="button"
              aria-label="Show password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-placeholder"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {creating && password.length > 0 && <PasswordStrengthIndicator password={password} isFocused={focused} />}
        </div>
        {creating && (
          <div className="space-y-1">
            <label className="text-13 font-medium text-tertiary" htmlFor="confirmation">
              Confirm password
            </label>
            <div className="relative flex items-center rounded-md bg-surface-1">
              <Input
                id="confirmation"
                type={showConfirmation ? "text" : "password"}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                placeholder="Confirm password"
                className="h-10 w-full border border-subtle !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
              />
              <button
                type="button"
                aria-label="Show confirmation"
                aria-pressed={showConfirmation}
                onClick={() => setShowConfirmation(!showConfirmation)}
                className="absolute right-3 text-placeholder"
              >
                {showConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {confirmation.length > 0 && password !== confirmation && (
              <p className="text-13 text-danger-primary">Passwords don&apos;t match</p>
            )}
          </div>
        )}
        <div className="space-y-2.5">
          <Button type="submit" variant="primary" className="w-full" size="xl" disabled={!valid}>
            {pending ? <Spinner height="20px" width="20px" /> : creating ? "Create account" : "Continue"}
          </Button>
          {!creating && magicEnabled && (
            <Button type="button" variant="secondary" className="w-full" size="xl" onClick={() => void onUseCode()}>
              Sign in with unique code
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
