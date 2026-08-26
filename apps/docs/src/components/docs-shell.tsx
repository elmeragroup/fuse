"use client";

import type { ReactElement, ReactNode } from "react";

import { ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";

import { Header } from "./header";
import { PreviewThemeProvider } from "./preview-theme";
import { QuickNav } from "./quick-nav";
import { SideNav } from "./side-nav";
import { MAIN_CONTENT_ID } from "./skip-nav";

const classNames = {
  root: "min-h-dvh bg-background text-docs-ink",
  columns:
    "mx-auto grid max-w-[1200px] grid-cols-1 min-[45rem]:grid-cols-[240px_minmax(0,1fr)] min-[60rem]:grid-cols-[240px_minmax(0,1fr)_180px]",
  main: "w-full min-w-0 max-w-[720px] px-6 pt-10 pb-24 min-[45rem]:px-12",
} as const;

export type DocsShellProps = {
  children: ReactNode;
};

export function DocsShell({ children }: DocsShellProps): ReactElement {
  return (
    <PreviewThemeProvider>
      <ElmeraGroupUiProvider locale="en-US">
        <div className={classNames.root} data-docs-root>
          <Header />
          <div className={classNames.columns}>
            <SideNav />
            <main className={classNames.main} id={MAIN_CONTENT_ID}>
              {children}
            </main>
            <QuickNav />
          </div>
        </div>
      </ElmeraGroupUiProvider>
    </PreviewThemeProvider>
  );
}
