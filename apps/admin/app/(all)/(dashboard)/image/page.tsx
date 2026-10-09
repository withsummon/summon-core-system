import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useAdminSession } from "@/providers/user.provider";
import { PageWrapper } from "@/components/common/page-wrapper";
import { InstanceImageConfigForm } from "./form";
import type { Route } from "./+types/page";

function InstanceImagePage() {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  const configuration = useQuery(api.identity.instance.image.get, allowed ? {} : "skip");
  const [initialValues, setInitialValues] = useState<FunctionArgs<typeof api.identity.instance.image.save> | null>(
    null
  );
  if (configuration && initialValues === null)
    setInitialValues({
      expectedRevision: configuration.revision,
      apiKey: configuration.credentialPresent ? "" : null,
    });
  return (
    <PageWrapper
      header={{
        title: "Third-party image libraries",
        description: "Let your users search and choose images from third-party libraries.",
      }}
    >
      {initialValues && <InstanceImageConfigForm initialValues={initialValues} configuration={configuration} />}
    </PageWrapper>
  );
}
export const meta: Route.MetaFunction = () => [{ title: "Images Settings - God Mode" }];
export default InstanceImagePage;
