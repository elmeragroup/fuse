"use client";

import { DotsThree, House, Package, Users } from "@elmeragroup/fuse/icons";
import { Sidebar } from "@elmeragroup/fuse/sidebar";

export function SidebarMenuAction() {
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-lg border border-border">
      <Sidebar.Provider bounds="container">
        <Sidebar.Root>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Sales</Sidebar.GroupLabel>
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
                    <Sidebar.MenuAction aria-label="Order actions">
                      <DotsThree />
                    </Sidebar.MenuAction>
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
          <Sidebar.Rail />
        </Sidebar.Root>
        <Sidebar.Inset>
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <Sidebar.Trigger />
            <span className="text-sm font-medium">Orders</span>
          </header>
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
