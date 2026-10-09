import Link from "next/link";
import { Settings2 } from "lucide-react";
import { getButtonStyling } from "@plane/propel/button";
import { ToggleSwitch } from "@plane/ui";
import { cn } from "@plane/utils";
import type { TGetAuthenticationModeProps } from "@/hooks/oauth/types";
export function GithubConfiguration({
  disabled,
  updateConfig,
  configuration,
}: Pick<TGetAuthenticationModeProps, "disabled" | "updateConfig" | "configuration">) {
  return configuration.configuredProviders.includes("github") ? (
    <div className="flex items-center gap-4">
      <Link href="/authentication/github" className={cn(getButtonStyling("link", "base"), "font-medium")}>
        Edit
      </Link>
      <ToggleSwitch
        value={configuration.authentication.providers.github}
        onChange={() => updateConfig({ providers: { github: !configuration.authentication.providers.github } })}
        size="sm"
        disabled={disabled}
      />
    </div>
  ) : (
    <Link href="/authentication/github" className={cn(getButtonStyling("secondary", "base"), "text-tertiary")}>
      <Settings2 className="h-4 w-4 p-0.5 text-tertiary" />
      Configure
    </Link>
  );
}
