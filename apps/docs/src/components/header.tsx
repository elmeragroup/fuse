"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { usePreviewTheme } from "./preview-theme";
import { SearchPalette } from "./search-palette";
import { ThemePicker } from "./theme-picker";

const header = tv({
  slots: {
    root: "h-docs-header border-docs-line bg-white/[92%] sticky top-0 z-10 flex items-center gap-6 border-b px-6 backdrop-blur-[8px]",
    wordmark:
      "text-docs-ink [&_span]:font-normal [&_span]:text-docs-sub focus-visible:outline-docs-ink text-[0.95rem] font-[650] tracking-[-0.01em] no-underline focus-visible:rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-2",
  },
});

export function Header(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();
  const { root, wordmark } = header();

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
