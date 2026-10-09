import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { setLanguage, SUPPORTED_LANGUAGES } from "@plane/i18n";
import { applyCustomTheme, clearCustomTheme } from "@plane/utils";
export function ProfileAppearance() {
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(api.identity.session.status, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.identity.profile.get, status?.valid ? {} : "skip");
  const theme = profile?.preferences.theme;
  const language = profile?.preferences.language;
  const { setTheme } = useTheme();
  const themeSetter = useRef(setTheme);
  useEffect(() => {
    themeSetter.current = setTheme;
  }, [setTheme]);

  // Apply saved preferences independently of next-themes local/storage setter identity.
  useEffect(() => {
    if (theme?.theme === undefined) return;
    themeSetter.current(theme.theme);
    if (theme.theme === "custom" && theme.primary && theme.background && theme.darkPalette !== undefined) {
      applyCustomTheme(theme.primary, theme.background, theme.darkPalette ? "dark" : "light");
      return clearCustomTheme;
    }
  }, [theme?.theme, theme?.primary, theme?.background, theme?.darkPalette]);
  useEffect(() => {
    const selected = SUPPORTED_LANGUAGES.find((option) => option.value === language);
    if (selected)
      void setLanguage(selected.value).catch((error) => console.error("Failed to apply saved language:", error));
  }, [language]);
  return null;
}
