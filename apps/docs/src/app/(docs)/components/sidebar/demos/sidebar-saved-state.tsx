"use client";

import { useState, useSyncExternalStore } from "react";

import { ChartBar, Gear, House, Package, Receipt, Users } from "@elmeragroup/fuse/icons";
import { SIDEBAR_COOKIE_NAME, Sidebar } from "@elmeragroup/fuse/sidebar";

const NAV = [
  { label: "Dashboard", icon: House, href: "#dashboard" },
  { label: "Orders", icon: Package, href: "#orders", active: true },
  { label: "Customers", icon: Users, href: "#customers" },
  { label: "Invoices", icon: Receipt, href: "#invoices" },
  { label: "Reports", icon: ChartBar, href: "#reports" },
];

/**
 * A server layout reads the cookie the Provider writes and passes it as `defaultOpen`, so the
 * first paint already has the saved state. In a Next.js layout:
 *
 *   const open = (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false";
 *   <Sidebar.Provider defaultOpen={open}>...</Sidebar.Provider>
 *
 * This demo has no server layout of its own, so it reads the cookie on the client. The server
 * snapshot is "open", and `defaultOpen` only counts on the first render, which hydration renders
 * with that snapshot. So the demo controls `open` instead: it follows the cookie once the page
 * has hydrated, and the user's choice after that. The rail renders open first and then closes,
 * which the server read avoids.
 */
function isSidebarOpen(cookieHeader: string): boolean {
  return !cookieHeader.split("; ").includes(`${SIDEBAR_COOKIE_NAME}=false`);
}

function subscribeNever(): () => void {
  return () => undefined;
}

function useSavedSidebarState(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => isSidebarOpen(document.cookie),
    () => true
  );
}

export function SidebarSavedState() {
  const saved = useSavedSidebarState();
  const [choice, setChoice] = useState<boolean>();

  return (
    <div className="relative h-[28rem] w-full overflow-hidden rounded-lg border border-border contain-paint">
      <Sidebar.Provider open={choice ?? saved} onOpenChange={setChoice} className="min-h-full">
        <Sidebar.Root className="h-full">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Sales</Sidebar.GroupLabel>
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
          <Sidebar.Rail />
        </Sidebar.Root>
        <Sidebar.Inset>
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <Sidebar.Trigger />
            <span className="text-sm font-medium">Orders</span>
          </header>
          <p className="text-sm p-4 text-muted-foreground">
            Close the rail and reload the page. The rail comes back closed, because the Provider wrote the
            state to its cookie.
          </p>
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
