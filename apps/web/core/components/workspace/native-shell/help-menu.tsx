import { HelpMenuView } from "../sidebar/help-section/view";
export function NativeHelpMenu() {
  return (
    <HelpMenuView
      onShortcuts={() =>
        window.open("https://docs.plane.so/support/keyboard-shortcuts", "_blank", "noopener,noreferrer")
      }
      onUpdates={() => window.open("https://go.plane.so/p-changelog", "_blank", "noopener,noreferrer")}
    />
  );
}
