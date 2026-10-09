import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useAdminSession } from "@/providers/user.provider";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Loader, ToggleSwitch } from "@plane/ui";
import giteaLogo from "@/app/assets/logos/gitea-logo.svg?url";
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { PageWrapper } from "@/components/common/page-wrapper";
import type { Route } from "./+types/page";
import { InstanceGiteaConfigForm } from "./form";

function InstanceGiteaAuthenticationPage(_props: Route.ComponentProps) {
  const { authority } = useAdminSession();
  const configuration = useQuery(
    api.identity.instance.oauth.get,
    authority?.isInstanceAdmin ? { provider: "gitea" } : "skip"
  );
  const policy = useQuery(api.identity.instance.authentication.get, authority?.isInstanceAdmin ? {} : "skip");
  const savePolicy = useMutation(api.identity.instance.authentication.save);
  const [pending, setPending] = useState(false);
  const [initialValues, setInitialValues] = useState<FunctionArgs<typeof api.identity.instance.oauth.save> | null>(
    null
  );
  useEffect(() => {
    if (configuration && initialValues === null)
      setInitialValues({
        provider: "gitea",
        expectedRevision: configuration.revision,
        configuration: {
          clientId: configuration.configuration?.clientId ?? "",
          clientSecret: "",
          sync: configuration.configuration?.sync ?? false,
          host: configuration.configuration?.host ?? "https://gitea.com",
          organization: configuration.configuration?.organization ?? undefined,
        },
      });
  }, [configuration, initialValues]);
  const enabled = policy?.authentication.providers.gitea ?? false;
  const toggle = async () => {
    if (!policy || pending || !authority?.isInstanceAdmin) return;
    setPending(true);
    try {
      await savePolicy({ expectedRevision: policy.revision, changes: { providers: { gitea: !enabled } } });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Configuration saved",
        message: "Gitea authentication is now " + (enabled ? "disabled." : "active."),
      });
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Configuration could not be saved",
        message: failure instanceof Error ? failure.message : "Try again.",
      });
    } finally {
      setPending(false);
    }
  };
  const header = (formPending: boolean) => (
    <AuthenticationMethodCard
      name="Gitea"
      description="Allow members to login or sign up to plane with their Gitea accounts."
      icon={<img src={giteaLogo} height={24} width={24} alt="Gitea Logo" />}
      config={
        <ToggleSwitch
          value={enabled}
          onChange={() => {
            void toggle();
          }}
          size="sm"
          disabled={pending || formPending || !initialValues || !policy || !authority?.isInstanceAdmin}
        />
      }
      disabled={pending || formPending || !configuration}
      withBorder={false}
    />
  );
  return initialValues ? (
    <InstanceGiteaConfigForm
      initialValues={initialValues}
      configuration={configuration}
      pending={pending}
      header={header}
    />
  ) : (
    <PageWrapper customHeader={header(false)}>
      <Loader className="space-y-8">
        <Loader.Item height="50px" width="25%" />
        <Loader.Item height="50px" />
        <Loader.Item height="50px" />
        <Loader.Item height="50px" />
        <Loader.Item height="50px" width="50%" />
      </Loader>
    </PageWrapper>
  );
}
export const meta: Route.MetaFunction = () => [{ title: "Gitea Authentication - God Mode" }];
export default InstanceGiteaAuthenticationPage;
