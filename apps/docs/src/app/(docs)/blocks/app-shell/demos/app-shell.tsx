"use client";

/**
 * The app's layout: the providers, a skip link, the sidebar and the inset panel with the header
 * and the page. Mount it once in the layout that wraps every page, so the sidebar, the command
 * menu and the toasts keep their state while the pages change.
 *
 * The sidebar remembers whether it is open in the `sidebar:state` cookie. To paint the first frame
 * the way the visitor left it, read the cookie in your server layout and pass it on:
 *
 *   const open = (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false";
 *   <AppShell defaultOpen={open}>{children}</AppShell>
 */

import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { usePathname } from "next/navigation";

import { Sidebar } from "@elmeragroup/fuse/sidebar";
import { LocaleProvider } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { APP_LOCALE } from "./app-config";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { TIME_ZONE } from "./power-data";

/** The id of the page content the skip link moves to. */
const CONTENT_ID = "app-content";

export type AppShellProps = {
  /** Whether the sidebar starts open on desktop. Pass the cookie's value for a matching first paint. */
  defaultOpen?: boolean;
  /** The current page. */
  children: ReactNode;
};

/**
 * The shell around every page. Every date and chart in it runs on Oslo's clock, wherever the
 * server or the visitor is.
 */
export function AppShell({ defaultOpen = true, children }: AppShellProps): ReactElement {
  const pathname = usePathname();
  const content = useRef<HTMLDivElement>(null);
  const shownPath = useRef(pathname);

  // Next swaps the page on a client navigation and leaves focus where it was: in the sidebar, or on
  // the trigger of the menu that navigated. So the new page's title takes focus, and the next Tab
  // and Page Down start in the page. The first load keeps the browser's own focus.
  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    const title = content.current?.querySelector<HTMLElement>("[data-page-title]");
    (title ?? content.current)?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <LocaleProvider locale={APP_LOCALE} timeZone={TIME_ZONE}>
      <Tooltip.Provider>
        <Toast.Provider>
          {/* Hidden until a keyboard reaches it, then a pill over the header's start. */}
          <a
            href={`#${CONTENT_ID}`}
            className="text-sm font-medium focus-visible:shadow-md sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-3 focus-visible:py-2 focus-visible:outline-2 focus-visible:outline-ring">
            Skip to content
          </a>
          <Sidebar.Provider defaultOpen={defaultOpen}>
            <AppSidebar />
            {/* From md the inset is a panel of the viewport's height that scrolls its page inside,
                as a desktop app does. On a phone the document scrolls and the header sticks. */}
            <Sidebar.Inset className="md:h-[calc(100svh-(--spacing(4)))] md:overflow-hidden">
              <AppHeader />
              {/* Keyed by route, so each page opens at its top, as a new document would. */}
              <div
                key={pathname}
                ref={content}
                id={CONTENT_ID}
                tabIndex={-1}
                className="md:min-h-0 md:overflow-y-auto flex flex-1 flex-col outline-none">
                {children}
              </div>
            </Sidebar.Inset>
          </Sidebar.Provider>
          <Toast.Viewport aria-label="Notifications" />
        </Toast.Provider>
      </Tooltip.Provider>
    </LocaleProvider>
  );
}
