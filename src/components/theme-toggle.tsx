"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  function handleCheckedChange(checked: boolean) {
    setTheme(checked ? "dark" : "light");
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <Sun className="size-4" aria-hidden />
          Dark mode
        </span>
        <Switch checked={false} aria-label="Theme" disabled />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm">
        {isDark ? (
          <Moon className="size-4" aria-hidden />
        ) : (
          <Sun className="size-4" aria-hidden />
        )}
        Dark mode
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={handleCheckedChange}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      />
    </div>
  );
}
