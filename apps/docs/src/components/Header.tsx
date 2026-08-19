"use client";

import type { ReactElement } from "react";

import Link from "next/link";

import type { ThemeInput } from "@elmeragroup/ui/theme";

import "./Header.css";
import { ThemePicker } from "./ThemePicker";

export type HeaderProps = {
  theme: ThemeInput;
  onThemeChange: (theme: ThemeInput) => void;
};

export function Header({ theme, onThemeChange }: HeaderProps): ReactElement {
  return (
    <header className="Header">
      <Link href="/" className="HeaderWordmark">
        elmera<span>/ui</span>
      </Link>
      <ThemePicker theme={theme} onThemeChange={onThemeChange} />
    </header>
  );
}
