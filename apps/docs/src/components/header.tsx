"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { usePreviewTheme } from "./preview-theme";
import { SearchPalette } from "./search-palette";
import { ThemePicker } from "./theme-picker";

const header = tv({
  slots: {
    root: "h-docs-header sm:flex-nowrap sm:px-6 sticky top-0 z-10 flex flex-wrap items-center gap-x-6 border-b border-border bg-background/95 px-4 backdrop-blur-[8px]",
    wordmark:
      "[&_span]:font-normal text-base font-semibold tracking-[-0.01em] text-foreground no-underline focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_span]:text-muted-foreground",
  },
});

const { root, wordmark } = header();

export function Header(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();

  return (
    <header className={root()}>
      <Link href="/" className={wordmark()}>
        elmera<span>/ui</span>
      </Link>
      <ThemePicker theme={theme} onThemeChange={setTheme} />
      <SearchPalette />
    </header>
  );
}
