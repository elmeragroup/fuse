"use client";

import type { ReactElement, ReactNode } from "react";

import { ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";

import { Header } from "./Header";
import { PreviewThemeProvider } from "./PreviewTheme";
import { QuickNav } from "./QuickNav";
import { SideNav } from "./SideNav";
import { MAIN_CONTENT_ID } from "./SkipNav";

export type DocsShellProps = {
  children: ReactNode;
};

export function DocsShell({ children }: DocsShellProps): ReactElement {
  return (
    <PreviewThemeProvider>
      <ElmeraGroupUiProvider locale="en-US">
        <div className="DocsRoot">
          <Header />
          <div className="DocsCols">
            <SideNav />
            <main className="DocsMain" id={MAIN_CONTENT_ID}>
              {children}
            </main>
            <QuickNav />
          </div>
        </div>
      </ElmeraGroupUiProvider>
    </PreviewThemeProvider>
  );
}
