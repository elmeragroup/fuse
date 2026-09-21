"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { ChartBar, ElmeraGroupLogo, Gear, House, Package, Receipt, Users } from "@elmeragroup/fuse/icons";
import { SIDEBAR_COOKIE_NAME, Sidebar } from "@elmeragroup/fuse/sidebar";

const NAV = [
  { label: "Dashboard", icon: House, href: "#dashboard" },
  { label: "Orders", icon: Package, href: "#orders", active: true },
  { label: "Customers", icon: Users, href: "#customers" },
  { label: "Invoices", icon: Receipt, href: "#invoices" },
  { label: "Reports", icon: ChartBar, href: "#reports" },
];

/**
 * The cookie the Provider writes is meant to be read on the server, so the first paint
 * already knows whether the rail is open. In a Next.js layout:
 *
 *   const open = (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false";
 *   <Sidebar.Provider defaultOpen={open}>…</Sidebar.Provider>
 *
 * This demo has no server layout of its own, so it reads the same cookie through
 * `useSyncExternalStore`: the server snapshot is "open", the client snapshot is the
 * cookie, and the initial `defaultOpen` therefore matches what SSR would have produced.
 */
function isSidebarOpen(cookieHeader: string): boolean {
  return !cookieHeader.split("; ").includes(`${SIDEBAR_COOKIE_NAME}=false`);
}

function subscribeNever(): () => void {
  return () => undefined;
}

function useSidebarCookie(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => isSidebarOpen(document.cookie),
    () => true
  );
}

export function SidebarAppFrame() {
  const defaultOpen = useSidebarCookie();

  return (
    <div className="relative h-[28rem] w-full overflow-hidden rounded-lg border border-border contain-paint">
      <Sidebar.Provider defaultOpen={defaultOpen} className="min-h-full">
        <Sidebar.Root className="h-full">
          <Sidebar.Header>
            <Sidebar.Input placeholder="Search orders" aria-label="Search orders" />
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Funnel</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {NAV.map(({ label, icon: Icon, href, active }) => (
                    <Sidebar.MenuItem key={label}>
                      <Sidebar.MenuButton
                        isActive={active}
                        render={<a href={href} aria-current={active ? "page" : undefined} />}>
                        <Icon />
                        <span>{label}</span>
                      </Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                  ))}
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
            <Sidebar.Separator />
            <Sidebar.Group>
              <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton render={<a href="#settings" />}>
                      <Gear />
                      <span>Settings</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Footer>
            <Sidebar.Icon>
              <ElmeraGroupLogo />
            </Sidebar.Icon>
          </Sidebar.Footer>
          <Sidebar.Rail />
        </Sidebar.Root>
        <Sidebar.Inset>
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <Sidebar.Trigger />
            <span className="text-sm font-medium">Orders</span>
            <span className="text-xs ml-auto text-muted-foreground">
              Press <kbd className="rounded border border-border px-1">⌘B</kbd> /{" "}
              <kbd className="rounded border border-border px-1">Ctrl+B</kbd> to toggle
            </span>
          </header>
          <div className="text-sm flex flex-1 flex-col gap-3 p-4 text-muted-foreground">
            <p>The rail pushes this inset aside on desktop and becomes a Sheet below 768px.</p>
            <Button variant="outline" className="self-start">
              New order
            </Button>
          </div>
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
