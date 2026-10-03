import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ImageIcon } from "lucide-react";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { CommonOnboardingHeader } from "@/components/onboarding/steps/common";
import { SetPasswordRoot } from "@/components/onboarding/steps/profile/set-password";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { newPasswordError } from "../auth-forms/password-validation";
import { ProfileAvatarDialog } from "./avatar";

type Profile = FunctionReturnType<typeof api.identity.profile.get>;
export function NativeProfileStep({
  profile,
  onComplete,
  onPendingChange,
}: {
  profile: Profile;
  onComplete: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [opening, setOpening] = useState(profile);
  const revision = useRef(opening.revision);
  const [name, setName] = useState(opening.firstName);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const appearance = useQuery(api.identity.avatar.get);
  const capabilities = useQuery(api.identity.password.index.capabilities);
  const complete = useMutation(api.identity.profile.completeProfile);
  const setAccountPassword = useMutation(api.identity.password.index.set);
  const invalidPassword = password ? newPasswordError(password, confirmation) : null;
  const disabled = pending || avatarOpen || !capabilities || invalidPassword !== null;
  const submit = async () => {
    if (disabled) return;
    setPending(true);
    onPendingChange?.(true);
    setError("");
    try {
      if (password) {
        await setAccountPassword({ newPassword: password });
        setPassword("");
        setConfirmation("");
      }
      await complete({
        firstName: name,
        lastName: opening.lastName,
        displayName: name,
        timezone: opening.timezone,
        expectedRevision: revision.current,
      });
      onComplete();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-10"
    >
      <CommonOnboardingHeader title="Create your profile." description="This is how you will appear in Plane." />
      {avatarOpen && (
        <ProfileAvatarDialog
          revision={revision.current}
          onClose={() => setAvatarOpen(false)}
          onAcknowledged={(starting, committed) => {
            if (revision.current === starting) revision.current = committed;
          }}
        />
      )}
      <div className="flex items-center gap-4">
        <button
          className="flex size-12 items-center justify-center rounded-full bg-accent-primary text-18 font-semibold text-on-color"
          type="button"
          disabled={pending}
          onClick={() => setAvatarOpen(true)}
          aria-label="Change profile image"
        >
          {appearance?.avatar ? (
            <AuthenticatedAssetImage
              key={appearance.avatar.id}
              asset={appearance.avatar}
              alt={opening.displayName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            name[0] || "R"
          )}
        </button>
        <button
          className="flex items-center gap-1.5 px-2 py-1 text-13 text-tertiary hover:text-secondary"
          type="button"
          disabled={pending}
          onClick={() => setAvatarOpen(true)}
        >
          <ImageIcon className="size-4" />
          <span className="text-13">{appearance?.avatar ? "Change image" : "Upload image"}</span>
        </button>
      </div>
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label
            className="block text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
            htmlFor="native-profile-name"
          >
            Name
          </label>
          <input
            id="native-profile-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- Preserve the existing profile-step initial focus.
            autoFocus
            maxLength={255}
            required
            placeholder="Enter your full name"
            autoComplete="name"
            className="w-full rounded-md border border-strong bg-surface-1 px-3 py-2 text-secondary transition-all duration-200 placeholder:text-placeholder focus:border-transparent focus:ring-2 focus:ring-accent-strong focus:outline-none"
          />
        </div>
        {(capabilities?.canSet || password.length > 0) && (
          <SetPasswordRoot
            disabled={pending}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmation}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      {profile.revision > revision.current && !avatarOpen && !pending && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpening(profile);
            revision.current = profile.revision;
            setName(profile.firstName);
            setPassword("");
            setConfirmation("");
            setError("");
          }}
        >
          Reload profile and discard edits
        </Button>
      )}
      <Button variant="primary" type="submit" className="w-full" size="xl" loading={pending} disabled={disabled}>
        Continue
      </Button>
    </form>
  );
}
