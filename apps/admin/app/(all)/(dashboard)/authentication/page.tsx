/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AdminFormNavigationGuard, useAdminSession } from "@/providers/user.provider";
import { useState } from "react";
import { useTheme } from "next-themes";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { setPromiseToast } from "@plane/propel/toast";
import { Loader, ToggleSwitch } from "@plane/ui";
import { cn, resolveGeneralTheme } from "@plane/utils";
import { PageWrapper } from "@/components/common/page-wrapper";
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { useAuthenticationModes } from "@/hooks/oauth";
// types
import type { Route } from "./+types/page";

function AuthenticationSettings() {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  const configuration = useQuery(api.identity.instance.authentication.get, allowed ? {} : "skip");
  const save = useMutation(api.identity.instance.authentication.save);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateConfig = (changes: FunctionArgs<typeof api.identity.instance.authentication.save>["changes"]) => {
    if (!allowed || !configuration || isSubmitting) return;
    setIsSubmitting(true);
    const promise = save({ expectedRevision: configuration.revision, changes });
    setPromiseToast(promise, {
      loading: "Saving configuration",
      success: { title: "Success", message: () => "Configuration saved successfully" },
      error: {
        title: "Error",
        message: (failure) => (failure instanceof Error ? failure.message : "Failed to save configuration"),
      },
    });
    void promise.finally(() => setIsSubmitting(false)).catch(() => {});
  };
  return (
    <>
      <AdminFormNavigationGuard pending={isSubmitting} />
      {configuration ? (
        <AuthenticationControls configuration={configuration} isSubmitting={isSubmitting} updateConfig={updateConfig} />
      ) : (
        <Loader className="space-y-10">
          <Loader.Item height="50px" width="75%" />
        </Loader>
      )}
    </>
  );
}
function AuthenticationControls({
  configuration,
  isSubmitting,
  updateConfig,
}: {
  configuration: FunctionReturnType<typeof api.identity.instance.authentication.get>;
  isSubmitting: boolean;
  updateConfig: (changes: FunctionArgs<typeof api.identity.instance.authentication.save>["changes"]) => void;
}) {
  const { resolvedTheme: currentTheme } = useTheme();
  const resolvedTheme = resolveGeneralTheme(currentTheme);
  const authenticationModes = useAuthenticationModes({
    configuration,
    disabled: isSubmitting,
    updateConfig,
    resolvedTheme,
  });

  return (
    <PageWrapper
      header={{
        title: "Manage authentication modes for your instance",
        description: "Configure authentication modes for your team and restrict sign-ups to be invite only.",
      }}
    >
      <div className="space-y-3">
        <div className={cn("flex w-full items-center gap-14 rounded-sm")}>
          <div className="flex grow items-center gap-4">
            <div className="grow">
              <div className="pb-1 text-16 font-medium">Allow anyone to sign up even without an invite</div>
              <div className={cn("text-11 leading-5 font-regular text-tertiary")}>
                Toggling this off will only let users sign up when they are invited.
              </div>
            </div>
          </div>
          <div className={`shrink-0 pr-4 ${isSubmitting && "opacity-70"}`}>
            <div className="flex items-center gap-4">
              <ToggleSwitch
                value={configuration.authentication.signupEnabled}
                onChange={() => updateConfig({ signupEnabled: !configuration.authentication.signupEnabled })}
                size="sm"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
        <div className="text-lg pt-6 font-medium">Available authentication modes</div>
        {authenticationModes.map((method) => (
          <AuthenticationMethodCard
            key={method.key}
            name={method.name}
            description={method.description}
            icon={method.icon}
            config={method.config}
            disabled={isSubmitting}
          />
        ))}
      </div>
    </PageWrapper>
  );
}

export const meta: Route.MetaFunction = () => [{ title: "Authentication Settings - Plane Web" }];

export default function InstanceAuthenticationPage(_props: Route.ComponentProps) {
  return <AuthenticationSettings />;
}
