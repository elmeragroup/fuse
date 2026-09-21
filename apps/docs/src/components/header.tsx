"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { usePreviewTheme } from "./preview-theme";
import { SearchPalette } from "./search-palette";
import { ThemePicker } from "./theme-picker";

const header = tv({
  slots: {
    root: "h-docs-header sm:px-6 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-x-6 border-b border-border bg-background/95 px-4",
    actions: "ml-auto flex items-center gap-3",
    wordmark:
      "text-base font-semibold text-foreground no-underline focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  },
});

const { root, wordmark, actions } = header();

export function Header(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();

  return (
    <header className={root()}>
      <Link href="/" className={wordmark()}>
        Fuse
      </Link>
      <div className={actions()}>
        <ThemePicker theme={theme} onThemeChange={setTheme} />
        <SearchPalette />
      </div>
    </header>
  );
}
