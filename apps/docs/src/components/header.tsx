"use client";

import type { ReactElement } from "react";

import Link from "next/link";

import "./header.css";
import { usePreviewTheme } from "./preview-theme";
import { SearchPalette } from "./search-palette";
import { ThemePicker } from "./theme-picker";

export function Header(): ReactElement {
  const { theme, setTheme } = usePreviewTheme();

  return (
    <header className="Header">
      <Link href="/" className="HeaderWordmark">
        elmera<span>/ui</span>
      </Link>
      <ThemePicker theme={theme} onThemeChange={setTheme} />
      <SearchPalette />
    </header>
  );
}
