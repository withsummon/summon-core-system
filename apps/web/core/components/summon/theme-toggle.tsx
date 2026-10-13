import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useUser, useUserProfile } from "@/hooks/store/user";

// The resolved theme is only known on the client, so render the server snapshot as not mounted.
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Switches the theme; a signed-in user's choice is also saved to their profile. */
export function SummonThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const user = useUser();
  const { updateUserTheme } = useUserProfile();
  const mounted = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);

  const dark = mounted && resolvedTheme === "dark";
  const nextTheme = dark ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => {
        setTheme(nextTheme);
        if (user.isAuthenticated) void updateUserTheme({ theme: nextTheme });
      }}
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary transition-colors hover:bg-layer-1 hover:text-primary"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
