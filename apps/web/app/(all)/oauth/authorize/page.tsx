/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Check } from "lucide-react";
import { Button } from "@plane/propel/button";
import type { ISummonOAuthRequest } from "@plane/types";
import { cn } from "@plane/utils";
import { SummonCoreLogo } from "@/components/summon/brand";
import { SummonSkeleton, SummonSkeletonBlock, SummonSkeletonText } from "@/components/summon/skeleton";
import { SummonThemeToggle } from "@/components/summon/theme-toggle";
import { WorkspaceLogo } from "@/components/workspace/logo";
import { useUser } from "@/hooks/store/user";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

/**
 * Consent screen for an MCP client (Claude Code, Cursor…) signing in with OAuth. Django keeps the client's
 * request under `requestId` while the person signs in; allowing it sends the browser back to the client with
 * a code for an API token in the chosen workspace.
 */
export default function OAuthAuthorizePage({ params }: Route.ComponentProps) {
  return (
    <AuthenticationWrapper>
      <div className="grid min-h-dvh w-full grid-rows-[auto_1fr] bg-surface-1 px-5 sm:px-10">
        <header className="flex h-16 items-center justify-between lg:h-20">
          <SummonCoreLogo />
          <SummonThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-[26rem] flex-col justify-center pt-6 pb-24">
          <ConsentRequest requestId={params.requestId} />
        </main>
      </div>
    </AuthenticationWrapper>
  );
}

type TAnswer = { state: "idle" } | { state: "sending"; approve: boolean } | { state: "sent" } | { state: "failed" };

const ConsentRequest = observer(function ConsentRequest({ requestId }: { requestId: string }) {
  const { data: currentUser } = useUser();
  const { data, error } = useSWR(["summon-oauth-request", requestId], () => summonService.getOAuthRequest(requestId), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const [chosen, setChosen] = useState<string>();
  const [answer, setAnswer] = useState<TAnswer>({ state: "idle" });

  if (error) {
    return (
      <Notice
        title="Can't connect to Summon"
        message={(error as { error_description?: string }).error_description ?? "Connect again from your MCP client."}
      />
    );
  }
  if (!data) return <ConsentSkeleton />;
  if (answer.state === "sent") {
    return <Notice title="You're connected" message={`Return to ${data.client_name}. You can close this tab.`} />;
  }

  const workspaceSlug = chosen ?? data.workspaces[0]?.slug;
  const respond = async (approve: boolean) => {
    setAnswer({ state: "sending", approve });
    try {
      const { redirect_to } = await summonService.answerOAuthRequest(
        requestId,
        approve && workspaceSlug ? { approve: true, workspace_slug: workspaceSlug } : { approve: false }
      );
      window.location.assign(redirect_to);
      // An app's own scheme leaves this page open; a web or loopback redirect replaces it.
      setAnswer({ state: "sent" });
    } catch {
      setAnswer({ state: "failed" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-20 font-semibold text-balance text-primary">Connect {data.client_name} to Summon</h1>
        <p className="mt-2 text-13 text-secondary">
          {data.client_name} will act as <span className="font-medium text-primary">{currentUser?.email}</span> in the
          workspace you choose, and can read and change what you can there.
        </p>
      </div>

      {data.workspaces.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-12 font-medium text-tertiary">Workspace</legend>
          {data.workspaces.map((workspace) => (
            <WorkspaceOption
              key={workspace.slug}
              workspace={workspace}
              checked={workspace.slug === workspaceSlug}
              onChoose={() => setChosen(workspace.slug)}
            />
          ))}
        </fieldset>
      ) : (
        <p className="rounded-lg border border-subtle bg-layer-1 p-3 text-13 text-secondary">
          You aren't in any workspace yet. Join or create one, then connect again.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {answer.state === "failed" ? (
          <p role="alert" className="text-12 text-danger-primary">
            That didn't go through. Try again, or connect again from {data.client_name}.
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1"
            disabled={!workspaceSlug || answer.state === "sending"}
            loading={answer.state === "sending" && answer.approve}
            onClick={() => void respond(true)}
          >
            Allow access
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="flex-1"
            disabled={answer.state === "sending"}
            loading={answer.state === "sending" && !answer.approve}
            onClick={() => void respond(false)}
          >
            Cancel
          </Button>
        </div>
        <p className="text-12 text-tertiary">
          Returns you to <span className="font-medium break-all text-secondary">{redirectTarget(data)}</span>. To
          disconnect later, delete its token under Profile settings → API tokens.
        </p>
      </div>
    </div>
  );
});

function WorkspaceOption(props: {
  workspace: ISummonOAuthRequest["workspaces"][number];
  checked: boolean;
  onChoose: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-strong",
        props.checked ? "border-accent-strong bg-accent-subtle" : "border-subtle hover:bg-layer-1"
      )}
    >
      <input
        type="radio"
        name="workspace"
        value={props.workspace.slug}
        checked={props.checked}
        onChange={props.onChoose}
        className="sr-only"
      />
      <WorkspaceLogo logo={null} name={props.workspace.name} classNames="size-7 text-12" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 font-medium text-primary">{props.workspace.name}</span>
        {/* Workspace names need not be unique; the slug (as in its URL) tells them apart. */}
        <span className="block truncate text-12 text-tertiary">{props.workspace.slug}</span>
      </span>
      <Check aria-hidden className={cn("size-4 text-accent-primary", !props.checked && "invisible")} />
    </label>
  );
}

function Notice(props: { title: string; message: string }) {
  return (
    <div role="status">
      <h1 className="text-20 font-semibold text-primary">{props.title}</h1>
      <p className="mt-2 text-13 text-secondary">{props.message}</p>
    </div>
  );
}

/** Mirrors the consent form: heading, two lines of copy, one workspace row, the buttons. */
function ConsentSkeleton() {
  return (
    <SummonSkeleton className="flex flex-col gap-6" label="Loading sign-in request">
      <div>
        <SummonSkeletonText className="text-20 font-semibold" width="w-64" />
        <SummonSkeletonText className="mt-2 text-13" width="w-full" />
        <SummonSkeletonText className="text-13" width="w-40" />
      </div>
      <div className="flex flex-col gap-2">
        <SummonSkeletonText className="mb-2 text-12" width="w-20" />
        <SummonSkeletonBlock className="h-15 w-full rounded-lg" />
      </div>
      <SummonSkeletonBlock className="h-9 w-full" />
    </SummonSkeleton>
  );
}

/** Where the client's redirect goes, as a person would recognise it: a host, or an app's own scheme. */
function redirectTarget(request: ISummonOAuthRequest) {
  // Django only registers parseable redirect URIs; show the raw one rather than crash if that ever changes.
  if (!URL.canParse(request.redirect_uri)) return request.redirect_uri;
  const url = new URL(request.redirect_uri);
  return url.protocol === "http:" || url.protocol === "https:" ? url.host : url.protocol.replace(/:$/, "");
}
