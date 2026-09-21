import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { LocaleProvider } from "@elmeragroup/fuse/theme";

import { Header } from "./header";
import { PreviewThemeProvider } from "./preview-theme";
import { QuickNav } from "./quick-nav";
import { SideNav } from "./side-nav";
import { MAIN_CONTENT_ID } from "./skip-nav";

const docsShell = tv({
  slots: {
    root: "min-h-dvh bg-background text-foreground",
    columns:
      "mx-auto grid max-w-[1200px] grid-cols-1 min-[45rem]:grid-cols-[240px_minmax(0,1fr)] min-[60rem]:grid-cols-[240px_minmax(0,1fr)_180px]",
    main: "w-full max-w-[720px] min-w-0 px-6 pt-10 pb-24 min-[45rem]:px-12",
  },
});

const { root, columns, main } = docsShell();

export type DocsShellProps = {
  children: ReactNode;
};

export function DocsShell({ children }: DocsShellProps): ReactElement {
  return (
    <PreviewThemeProvider>
      <LocaleProvider locale="en-US">
        <div className={root()} data-docs-root>
          <Header />
          <div className={columns()}>
            <SideNav />
            <main className={main()} id={MAIN_CONTENT_ID}>
              {children}
            </main>
            <QuickNav />
          </div>
        </div>
      </LocaleProvider>
    </PreviewThemeProvider>
  );
}
