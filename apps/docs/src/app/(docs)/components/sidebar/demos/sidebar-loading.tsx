"use client";

import { Sidebar } from "@elmeragroup/fuse/sidebar";

export function SidebarLoading() {
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
                    <Sidebar.MenuSkeleton showIcon />
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuSkeleton showIcon />
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuSkeleton showIcon />
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
