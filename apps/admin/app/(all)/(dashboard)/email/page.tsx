import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useAdminSession } from "@/providers/user.provider";
import { PageWrapper } from "@/components/common/page-wrapper";
import { InstanceEmailForm } from "./email-config-form";
import type { Route } from "./+types/page";

function InstanceEmailPage() {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  const configuration = useQuery(api.identity.instance.email.get, allowed ? {} : "skip");
  const [initialValues, setInitialValues] = useState<FunctionArgs<typeof api.identity.instance.email.save> | null>(
    null
  );
  if (configuration && initialValues === null)
    setInitialValues({ expectedRevision: configuration.revision, apiKey: configuration.credentialPresent ? "" : null });
  return (
    <PageWrapper
      header={{
        title: "Email settings",
        description:
          "Send account and invitation emails through Resend. Save your settings before sending a test email.",
      }}
    >
      {initialValues && <InstanceEmailForm initialValues={initialValues} configuration={configuration} />}
    </PageWrapper>
  );
}
export const meta: Route.MetaFunction = () => [{ title: "Email Settings - God Mode" }];
export default InstanceEmailPage;
