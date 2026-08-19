"use client";

import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { ElmeraGroupUiProvider, ThemeProvider } from "@elmeragroup/ui/theme";
import type { ThemeInput } from "@elmeragroup/ui/theme";

import { DEFAULT_THEME } from "../lib/theme";
import { Header } from "./Header";
import { QuickNav } from "./QuickNav";
import { SideNav } from "./SideNav";
import { MAIN_CONTENT_ID } from "./SkipNav";

export type DocsShellProps = {
  children: ReactNode;
};

export function DocsShell({ children }: DocsShellProps): ReactElement {
  const [theme, setTheme] = useState<ThemeInput>(DEFAULT_THEME);

  return (
    <ThemeProvider theme={theme}>
      <ElmeraGroupUiProvider locale="en-US">
        <div className="DocsRoot">
          <Header theme={theme} onThemeChange={setTheme} />
          <div className="DocsCols">
            <SideNav />
            <main className="DocsMain" id={MAIN_CONTENT_ID}>
              {children}
            </main>
            <QuickNav />
          </div>
        </div>
      </ElmeraGroupUiProvider>
    </ThemeProvider>
  );
}
