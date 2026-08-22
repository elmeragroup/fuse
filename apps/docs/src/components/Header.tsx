"use client";

import type { ReactElement } from "react";

import Link from "next/link";

import "./Header.css";
import { usePreviewTheme } from "./PreviewTheme";
import { SearchPalette } from "./SearchPalette";
import { ThemePicker } from "./ThemePicker";

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
