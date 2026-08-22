import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function SummonThemeToggle({ onChange }: { onChange?: (theme: "light" | "dark") => unknown }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  const nextTheme = dark ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => {
        setTheme(nextTheme);
        void onChange?.(nextTheme);
      }}
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary transition-colors hover:bg-layer-1 hover:text-primary"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
