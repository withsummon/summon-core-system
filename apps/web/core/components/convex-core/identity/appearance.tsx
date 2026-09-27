import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { applyCustomTheme, clearCustomTheme } from "@plane/utils";
export function ProfileAppearance({
  theme,
}: {
  theme: FunctionReturnType<typeof api.identity.profile.get>["preferences"]["theme"];
}) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!theme.theme) return;
    setTheme(theme.theme);
    if (theme.theme === "custom" && theme.primary && theme.background && theme.darkPalette !== undefined) {
      applyCustomTheme(theme.primary, theme.background, theme.darkPalette ? "dark" : "light");
      return clearCustomTheme;
    }
  }, [theme.theme, theme.primary, theme.background, theme.darkPalette, setTheme]);
  return null;
}
