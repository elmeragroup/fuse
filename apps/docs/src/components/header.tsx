"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { usePreviewTheme } from "./preview-theme";
import { SearchPalette } from "./search-palette";
import { ThemePicker } from "./theme-picker";

const header = tv({
  slots: {
    root: "h-docs-header sm:px-6 sticky top-0 z-10 flex items-center gap-x-6 border-b border-border bg-background/95 px-4 backdrop-blur-[8px]",
    actions: "ml-auto flex items-center gap-4",
    divider: "h-5 w-px bg-border",
    wordmark:
      "[&_span]:font-normal text-base font-semibold tracking-[-0.01em] text-foreground no-underline focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_span]:text-muted-foreground",
  },
});

const { root, wordmark, actions, divider } = header();

export function Header(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();

  return (
    <header className={root()}>
      <Link href="/" className={wordmark()}>
        elmera<span>/ui</span>
      </Link>
      <div className={actions()}>
        <ThemePicker theme={theme} onThemeChange={setTheme} />
        <div aria-hidden="true" className={divider()} />
        <SearchPalette />
      </div>
    </header>
  );
}
