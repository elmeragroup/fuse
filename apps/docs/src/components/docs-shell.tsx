"use client";

import type { ReactElement, ReactNode } from "react";

import { ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";

import { Header } from "./header";
import { PreviewThemeProvider } from "./preview-theme";
import { QuickNav } from "./quick-nav";
import { SideNav } from "./side-nav";
import { MAIN_CONTENT_ID } from "./skip-nav";

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
