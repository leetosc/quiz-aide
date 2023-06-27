import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "~/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      variant="outline"
      className=" bg-gray-800 px-3  transition-all hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      {theme === "light" ? (
        <Moon className={`h-[1.2rem] w-[1.2rem] text-white transition-all`} />
      ) : (
        <Sun className={`h-[1.2rem] w-[1.2rem] text-white transition-all`} />
      )}

      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
