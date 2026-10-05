import { ToggleSwitch } from "@plane/ui";
import type { TGetAuthenticationModeProps } from "@/hooks/oauth/types";
export function PasswordLoginConfiguration({
  disabled,
  updateConfig,
  configuration,
}: Pick<TGetAuthenticationModeProps, "disabled" | "updateConfig" | "configuration">) {
  return (
    <ToggleSwitch
      value={configuration.authentication.passwordEnabled}
      onChange={() => updateConfig({ passwordEnabled: !configuration.authentication.passwordEnabled })}
      size="sm"
      disabled={disabled}
    />
  );
}
