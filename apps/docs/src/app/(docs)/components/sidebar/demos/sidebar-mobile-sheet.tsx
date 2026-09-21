"use client";

import { House, Package, Users } from "@elmeragroup/fuse/icons";
import { Sidebar, useSidebar } from "@elmeragroup/fuse/sidebar";

function ViewportNote() {
  const { isMobile } = useSidebar();
  return (
    <p className="text-sm p-4 text-muted-foreground">
      {isMobile
        ? "Below 768px the rail is a Sheet: open it from the trigger, dismiss with Escape or the scrim. It is 18rem wide and has no close button."
        : "Narrow the browser below 768px to see the Sheet branch take over from the desktop rail."}
    </p>
  );
}

export function SidebarMobileSheet() {
  return (
    <div className="relative h-[20rem] w-full overflow-hidden rounded-lg border border-border contain-paint">
      <Sidebar.Provider className="min-h-full">
        <Sidebar.Root className="h-full">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>
                      <House />
                      <span>Dashboard</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton isActive>
                      <Package />
                      <span>Orders</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>
                      <Users />
                      <span>Customers</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Content>
        </Sidebar.Root>
        <Sidebar.Inset>
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <Sidebar.Trigger />
            <span className="text-sm font-medium">Mobile Sheet</span>
          </header>
          <ViewportNote />
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
