/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FunctionArgs } from "convex/server";
import { useAdminSession } from "@/providers/user.provider";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
// hooks
// local imports
import { GeneralConfigurationForm } from "./form";
// types
import type { Route } from "./+types/page";

function GeneralPage() {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  const configuration = useQuery(api.identity.instance.configuration.get, allowed ? {} : "skip");
  const [initialValues, setInitialValues] = useState<FunctionArgs<
    typeof api.identity.instance.configuration.save
  > | null>(null);
  if (configuration && initialValues === null)
    setInitialValues({
      instanceName: configuration.instanceName,
      telemetryEnabled: configuration.telemetryEnabled,
      expectedRevision: configuration.revision,
    });

  return (
    <PageWrapper
      header={{
        title: "General settings",
        description:
          "Change the name of your instance and instance admin e-mail addresses. Enable or disable telemetry in your instance.",
      }}
    >
      {initialValues && <GeneralConfigurationForm initialValues={initialValues} configuration={configuration} />}
    </PageWrapper>
  );
}

export const meta: Route.MetaFunction = () => [{ title: "General Settings - God Mode" }];

export default GeneralPage;
