import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { LocaleProvider } from "@elmeragroup/fuse/theme";

import { DocsColumns } from "./docs-columns";
import { DocsPalette } from "./docs-palette";
import { Header } from "./header";
import { PreviewThemeProvider } from "./preview-theme";
import { QuickNav } from "./quick-nav";
import { SideNav } from "./side-nav";
import { MAIN_CONTENT_ID } from "./skip-nav";
import { TemporalPolyfill } from "./temporal-polyfill";

const docsShell = tv({
  slots: {
    root: "min-h-dvh bg-background text-foreground",
    // The prose measure, which a wide route's page gives up (DocsColumns).
    main: "w-full max-w-[720px] min-w-0 px-6 pt-10 pb-24 group-data-[layout=wide]/columns:max-w-none min-[45rem]:px-12",
  },
});

const { root, main } = docsShell();

type DocsShellProps = {
  children: ReactNode;
};

export function DocsShell({ children }: DocsShellProps): ReactElement {
  return (
    <PreviewThemeProvider>
      <TemporalPolyfill />
      <LocaleProvider locale="en-US">
        <DocsPalette>
          <div className={root()} data-docs-root>
            <Header />
            <DocsColumns>
              <SideNav />
              <main className={main()} id={MAIN_CONTENT_ID}>
                {children}
              </main>
              <QuickNav />
            </DocsColumns>
          </div>
        </DocsPalette>
      </LocaleProvider>
    </PreviewThemeProvider>
  );
}
