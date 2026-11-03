"use client";

/**
 * The sidebar: the app's mark, the pages in their groups and Settings at the foot. On desktop it
 * collapses to icons, each with a tooltip; below 768px it is a Sheet that a page link closes.
 */

import type { ReactElement } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Lightning } from "@elmeragroup/fuse/icons";
import { Sidebar, useSidebar } from "@elmeragroup/fuse/sidebar";

import { APP_HOME, APP_PAGE_GROUPS, pageForPath } from "./app-config";
import type { AppPage } from "./app-config";
import { INVOICES } from "./power-data";

/** Overdue invoices, which the Invoices entry counts so they get seen. */
const OVERDUE = INVOICES.filter((invoice) => invoice.state._tag === "Overdue").length;

function PageLink({ page, current }: { page: AppPage; current: boolean }): ReactElement {
  const { setOpenMobile } = useSidebar();
  const Icon = page.icon;
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton
        isActive={current}
        tooltip={page.label}
        render={
          <Link
            href={page.href}
            aria-current={current ? "page" : undefined}
            onClick={() => {
              setOpenMobile(false);
            }}
          />
        }>
        <Icon />
        <span>{page.label}</span>
      </Sidebar.MenuButton>
      {page.label === "Invoices" && OVERDUE > 0 ? (
        <Sidebar.MenuBadge>
          {OVERDUE}
          <span className="sr-only"> overdue</span>
        </Sidebar.MenuBadge>
      ) : null}
    </Sidebar.MenuItem>
  );
}

/** The app's sidebar. */
export function AppSidebar(): ReactElement {
  const current = pageForPath(usePathname());
  const { setOpenMobile } = useSidebar();
  const groups = APP_PAGE_GROUPS.filter((group) => group.label !== "Account");
  const account = APP_PAGE_GROUPS.find((group) => group.label === "Account")?.pages ?? [];

  return (
    <Sidebar.Root collapsible="icon" variant="inset">
      <Sidebar.Header>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size="lg"
              tooltip="Overview"
              render={
                <Link
                  href={APP_HOME}
                  onClick={() => {
                    setOpenMobile(false);
                  }}
                />
              }>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-brand text-sidebar-brand-foreground">
                <Lightning className="size-4.5" />
              </span>
              <span className="leading-tight grid min-w-0 flex-1 text-left">
                <span className="text-sm font-semibold truncate">Back office</span>
                <span className="text-xs truncate text-sidebar-foreground/70">Power retail</span>
              </span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Header>
      <Sidebar.Content>
        {groups.map((group) => (
          <Sidebar.Group key={group.label}>
            <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                {group.pages.map((page) => (
                  <PageLink key={page.href} page={page} current={current?.href === page.href} />
                ))}
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Menu>
          {account.map((page) => (
            <PageLink key={page.href} page={page} current={current?.href === page.href} />
          ))}
        </Sidebar.Menu>
      </Sidebar.Footer>
      <Sidebar.Rail />
    </Sidebar.Root>
  );
}
