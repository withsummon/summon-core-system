import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { IssueFiltersDropdown } from "@/components/issues/filters";
import useIsInIframe from "@/hooks/use-is-in-iframe";
import { IssuesLayoutSelection } from "./layout-selection";
import { NavbarTheme } from "./theme";
import { UserAvatar } from "./user-avatar";

export function NavbarControls({
  publishSettings,
}: {
  publishSettings: FunctionReturnType<typeof api.publicSharing.index.settings>;
}) {
  const isInIframe = useIsInIframe();
  return (
    <>
      <div className="shrink-0">
        <IssuesLayoutSelection viewProps={publishSettings.settings.viewProps} />
      </div>
      <div className="shrink-0">
        <IssueFiltersDropdown />
      </div>
      <div className="shrink-0">
        <NavbarTheme />
      </div>
      {!isInIframe && <UserAvatar />}
    </>
  );
}
