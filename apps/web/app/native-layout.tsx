import { Outlet } from "react-router";
import { useTheme } from "next-themes";
import { TranslationProvider } from "@plane/i18n";
import { Toast } from "@plane/propel/toast";
import { resolveGeneralTheme } from "@plane/utils";

export default function NativeLayout() {
  const { resolvedTheme } = useTheme();
  return (
    <TranslationProvider>
      <Toast theme={resolveGeneralTheme(resolvedTheme)} />
      <Outlet />
    </TranslationProvider>
  );
}
