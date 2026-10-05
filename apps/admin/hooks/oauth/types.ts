import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
export type TGetAuthenticationModeProps = {
  disabled: boolean;
  configuration: FunctionReturnType<typeof api.identity.instance.authentication.get>;
  updateConfig: (changes: FunctionArgs<typeof api.identity.instance.authentication.save>["changes"]) => void;
  resolvedTheme: string | undefined;
};
