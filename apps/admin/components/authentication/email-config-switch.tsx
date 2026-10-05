import { ToggleSwitch } from "@plane/ui";
import type { TGetAuthenticationModeProps } from "@/hooks/oauth/types";
export function EmailCodesConfiguration({
  disabled,
  updateConfig,
  configuration,
}: Pick<TGetAuthenticationModeProps, "disabled" | "updateConfig" | "configuration">) {
  return (
    <ToggleSwitch
      value={configuration.authentication.magicEnabled}
      onChange={() => updateConfig({ magicEnabled: !configuration.authentication.magicEnabled })}
      size="sm"
      disabled={disabled}
    />
  );
}
