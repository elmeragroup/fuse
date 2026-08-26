"use client";

import type { ReactElement } from "react";

import Link from "next/link";

import { usePreviewTheme } from "./preview-theme";
import { SearchPalette } from "./search-palette";
import { ThemePicker } from "./theme-picker";

const classNames = {
  root: "sticky top-0 z-10 flex h-docs-header items-center gap-6 border-b border-docs-line bg-white/[92%] px-6 backdrop-blur-[8px]",
  wordmark:
    "text-[0.95rem] font-[650] tracking-[-0.01em] text-docs-ink no-underline [&_span]:font-normal [&_span]:text-docs-sub focus-visible:rounded-[6px] focus-visible:outline-2 focus-visible:outline-docs-ink focus-visible:outline-offset-2",
} as const;

export function Header(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();

  return (
    <header className={classNames.root}>
      <Link href="/" className={classNames.wordmark}>
        elmera<span>/ui</span>
      </Link>
      <ThemePicker theme={theme} onThemeChange={setTheme} />
      <SearchPalette />
    </header>
  );
}
