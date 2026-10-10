"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // resolvedTheme is undefined on the server and during the client's
  // very first render -- next-themes only knows the real value after
  // its own effect runs. Branching on that directly (rather than
  // tracking a redundant "mounted" state of our own) avoids a
  // hydration mismatch without a setState-in-effect of our own.
  if (!resolvedTheme) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled>
        <Sun size={18} />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
