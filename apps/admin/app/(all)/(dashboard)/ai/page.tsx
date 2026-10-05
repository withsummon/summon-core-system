/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { Loader } from "@plane/ui";
import { PageWrapper } from "@/components/common/page-wrapper";
import { useAdminSession } from "@/providers/user.provider";
import type { Route } from "./+types/page";
import { InstanceAIForm } from "./form";

function InstanceAIPage(_props: Route.ComponentProps) {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  const configuration = useQuery(api.identity.instance.ai.get, allowed ? {} : "skip");
  const [initialValues, setInitialValues] = useState<FunctionArgs<typeof api.identity.instance.ai.save> | null>(null);
  if (configuration?.configuration && initialValues === null) {
    const stored = configuration.configuration;
    setInitialValues({
      expectedRevision: configuration.revision,
      provider: stored.provider,
      model: stored.model,
      baseUrl: stored.baseUrl,
      timeout: stored.timeout,
      key: "",
    });
  }
  return (
    <PageWrapper
      header={{
        title: "AI features for all your workspaces",
        description: "Configure your AI API credentials so Plane AI features are turned on for all your workspaces.",
      }}
    >
      {configuration?.adoptionRequired && <p role="alert">AI configuration requires explicit operator adoption.</p>}
      {initialValues ? (
        <InstanceAIForm initialValues={initialValues} configuration={configuration} />
      ) : (
        !configuration?.adoptionRequired && (
          <Loader className="space-y-8">
            <Loader.Item height="50px" width="40%" />
            <div className="grid w-2/3 grid-cols-2 gap-x-8 gap-y-4">
              <Loader.Item height="50px" />
              <Loader.Item height="50px" />
            </div>
            <Loader.Item height="50px" width="20%" />
          </Loader>
        )
      )}
    </PageWrapper>
  );
}

export const meta: Route.MetaFunction = () => [{ title: "Artificial Intelligence Settings - God Mode" }];

export default InstanceAIPage;
