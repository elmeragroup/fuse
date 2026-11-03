"use client";

/**
 * The header across the top of every page: the sidebar toggle, a breadcrumb to the current page,
 * the command menu's search button and the user menu.
 */

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { Separator } from "@elmeragroup/fuse/separator";
import { Sidebar } from "@elmeragroup/fuse/sidebar";

import { APP_HOME, pageForPath } from "./app-config";
import { CommandMenu } from "./command-menu";
import { UserMenu } from "./user-menu";

/** The app's header. */
export function AppHeader(): ReactElement {
  const page = pageForPath(usePathname());
  return (
    // Sticks on a phone, where the document scrolls; from md the page scrolls under it instead.
    <header className="md:static md:rounded-t-xl sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Sidebar.Trigger />
      <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-auto" />
      <Breadcrumb.Root className="min-w-0">
        <Breadcrumb.List>
          {/* The app's name gives way to the page's on a narrow screen. */}
          <Breadcrumb.Item className="sm:inline-flex hidden">
            {page?.href === APP_HOME ? (
              <span>Back office</span>
            ) : (
              <Breadcrumb.Link render={<Link href={APP_HOME} />}>Back office</Breadcrumb.Link>
            )}
          </Breadcrumb.Item>
          <Breadcrumb.Separator className="sm:inline-flex hidden" />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{page?.label ?? "Not found"}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
      <div className="ml-auto flex items-center gap-2">
        <CommandMenu />
        <UserMenu />
      </div>
    </header>
  );
}
