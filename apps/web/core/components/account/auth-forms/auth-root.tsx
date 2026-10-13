/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ProhibitIcon, UserCircleMinusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { SITE_TITLE } from "@plane/constants";
import type { TOAuthOption } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import type { TAuthErrorInfo } from "@/helpers/authentication.helper";
import { EAuthModes, EAuthSteps, EAuthenticationErrorCodes, authErrorHandler } from "@/helpers/authentication.helper";
import { useOAuthConfig } from "@/hooks/oauth";
import { useInstance } from "@/hooks/store/use-instance";
import { AuthFormRoot } from "./form-root";

type TAuthRoot = {
  authMode: EAuthModes;
};

type TBlockedInfo = { icon: Icon; title: string; body: string };

/** Errors that end the sign-in attempt: the card swaps to a recovery state instead of the sign-in options. */
const BLOCKED: Partial<Record<EAuthenticationErrorCodes, TBlockedInfo>> = {
  [EAuthenticationErrorCodes.SIGNUP_DISABLED]: {
    icon: UserCircleMinusIcon,
    title: "You're not on this workspace yet",
    body: "Ask a workspace admin to invite this email, then sign in again.",
  },
  [EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED]: {
    icon: ProhibitIcon,
    title: "This account is deactivated",
    body: "Contact an admin to restore it.",
  },
};

/** Errors shown above the options, so the person can simply try again. */
const INLINE: Partial<Record<EAuthenticationErrorCodes, string>> = {
  [EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED]: "Google sign-in isn't set up on this server yet.",
  [EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR]: "Google sign-in didn't finish. Try again.",
};

/** Codes the email/password form owns; arriving with one opens that form at the right step. */
const PASSWORD_STEP_CODES = new Set([
  EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN,
  EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP,
]);

/** Reads the error once, then drops it (and the email it carries) from the address bar and history. */
const useAuthArrival = () => {
  const searchParams = useSearchParams();
  const [arrival] = useState(() => ({
    code: (searchParams.get("error_code") ?? undefined) as EAuthenticationErrorCodes | undefined,
    email: searchParams.get("email") ?? "",
  }));
  useEffect(() => {
    if (!arrival.code) return;
    const url = new URL(window.location.href);
    ["error_code", "error_message", "email"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, "", url);
  }, [arrival.code]);
  return arrival;
};

const getInitialErrorInfo = (code: EAuthenticationErrorCodes | undefined, email: string) =>
  code && !BLOCKED[code] && !INLINE[code] ? authErrorHandler(code, email || undefined) : undefined;

const getInlineError = (code: EAuthenticationErrorCodes | undefined, hasGoogle: boolean) =>
  (code && INLINE[code]) ||
  (!hasGoogle ? "Google sign-in isn't set up on this server yet. An instance admin can turn it on." : undefined);

/**
 * Google-first sign-in. Access is invite-only, so the card has no sign-up path: an admin adds the
 * email on Settings → Users and the first Google sign-in joins it. Email and password stay available
 * as a "test account" path only where the instance enables them (local and staging).
 */
export const AuthRoot = observer(function AuthRoot(props: TAuthRoot) {
  const { authMode: currentAuthMode } = props;
  const { config } = useInstance();
  const { oAuthOptions } = useOAuthConfig("Continue");
  const arrival = useAuthArrival();

  const opensPasswordForm = arrival.code !== undefined && PASSWORD_STEP_CODES.has(arrival.code);
  const [blocked, setBlocked] = useState(arrival.code ? BLOCKED[arrival.code] : undefined);
  const [errorInfo, setErrorInfo] = useState<TAuthErrorInfo | undefined>(() =>
    getInitialErrorInfo(arrival.code, arrival.email)
  );

  const providers = oAuthOptions.filter((option) => option.enabled);
  const google = providers.find((option) => option.id === "google");
  const isTestAccountEnabled = Boolean(config?.is_email_password_enabled || config?.is_magic_login_enabled);
  const inlineError = getInlineError(arrival.code, Boolean(google));

  if (blocked) {
    return (
      <BlockedAuthCard blocked={blocked} email={arrival.email} google={google} onBack={() => setBlocked(undefined)} />
    );
  }

  return (
    <>
      <AuthCard title={`Sign in to ${SITE_TITLE}`} description="Use the Google account your workspace invited.">
        {inlineError || errorInfo ? <AuthAlert message={inlineError ?? errorInfo?.message} /> : null}

        {providers.length > 0 ? (
          <div className="grid gap-2">
            {providers.map((option) => (
              <ProviderButton key={option.id} option={option} />
            ))}
          </div>
        ) : null}

        {isTestAccountEnabled ? (
          <TestAccountSection
            currentAuthMode={currentAuthMode}
            initialEmail={arrival.email}
            opensPasswordForm={opensPasswordForm}
            setErrorInfo={setErrorInfo}
          />
        ) : null}
      </AuthCard>
      <p className="text-center text-12 text-tertiary">
        Need access? Ask a workspace admin to invite your Google account.
      </p>
    </>
  );
});

function BlockedAuthCard(props: {
  blocked: TBlockedInfo;
  email: string;
  google: TOAuthOption | undefined;
  onBack: () => void;
}) {
  const { blocked, email, google, onBack } = props;
  const { icon: BlockedIcon, title, body } = blocked;
  return (
    <AuthCard title={title} icon={<BlockedIcon className="size-5" weight="duotone" />}>
      <p className="text-13 text-secondary">{body}</p>
      {email ? (
        <p className="rounded-lg border border-subtle bg-layer-1 px-3 py-2.5 text-13 text-secondary">
          You signed in to Google as <span className="font-medium break-all text-primary">{email}</span>
        </p>
      ) : null}
      <div className="grid gap-2">
        {google ? <ProviderButton option={google} label="Use another account" /> : null}
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg text-13 font-medium text-secondary hover:bg-layer-1 hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Back to sign in
        </button>
      </div>
    </AuthCard>
  );
}

function AuthAlert({ message }: { message: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger-subtle bg-danger-subtle px-3 py-2.5 text-13 text-danger-primary"
    >
      <WarningCircleIcon className="mt-0.5 size-4 flex-none" weight="fill" />
      <span>{message}</span>
    </p>
  );
}

/** Email/password sign-in, collapsed behind a button until the person asks for it. */
function TestAccountSection(props: {
  currentAuthMode: EAuthModes;
  initialEmail: string;
  opensPasswordForm: boolean;
  setErrorInfo: (errorInfo: TAuthErrorInfo | undefined) => void;
}) {
  const { currentAuthMode, initialEmail, opensPasswordForm, setErrorInfo } = props;
  const [showTestAccount, setShowTestAccount] = useState(opensPasswordForm);
  const [authMode, setAuthMode] = useState(currentAuthMode);
  const [authStep, setAuthStep] = useState(opensPasswordForm ? EAuthSteps.PASSWORD : EAuthSteps.EMAIL);
  const [email, setEmail] = useState(initialEmail);

  if (!showTestAccount) {
    return (
      <button
        type="button"
        onClick={() => setShowTestAccount(true)}
        className="mx-auto h-9 rounded-lg px-3 text-13 font-medium text-tertiary hover:bg-layer-1 hover:text-primary"
      >
        Use a test account
      </button>
    );
  }

  return (
    <div className="grid gap-4 border-t border-subtle pt-5">
      <p className="text-12 font-medium text-tertiary">Test account</p>
      <AuthFormRoot
        authStep={authStep}
        authMode={authMode}
        email={email}
        setEmail={setEmail}
        setAuthMode={setAuthMode}
        setAuthStep={setAuthStep}
        setErrorInfo={setErrorInfo}
        currentAuthMode={currentAuthMode}
      />
    </div>
  );
}

/** The sign-in column's heading block; a tone icon marks states that ended the attempt. */
function AuthCard(props: { title: string; description?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const { title, description, icon, children } = props;
  return (
    <>
      <PageHead title={`Sign in - ${SITE_TITLE}`} />
      <section className="w-full animate-panel-rise motion-reduce:animate-none">
        {icon ? (
          <span className="mb-5 grid size-10 place-items-center rounded-xl bg-warning-subtle text-warning-primary">
            {icon}
          </span>
        ) : null}
        <h1 className="text-24 font-semibold tracking-tight text-balance text-primary">{title}</h1>
        {description ? <p className="mt-2 text-14 text-secondary">{description}</p> : null}
        <div className="mt-8 grid gap-4">{children}</div>
      </section>
    </>
  );
}

function ProviderButton(props: { option: TOAuthOption; label?: string }) {
  const { option, label } = props;
  return (
    <button
      type="button"
      onClick={option.onClick}
      className="flex h-11 w-full press items-center justify-center gap-2.5 rounded-[10px] border border-strong bg-surface-1 text-14 font-medium text-primary shadow-tactile transition-[background-color] duration-150 hover:bg-layer-1"
    >
      <span className="grid size-[18px] place-items-center">{option.icon}</span>
      {label ?? option.text}
    </button>
  );
}
