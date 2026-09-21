"use client";

import { ChartBar, House, Package, Receipt, Users } from "@elmeragroup/fuse/icons";
import { Sidebar } from "@elmeragroup/fuse/sidebar";

const NAV = [
  { label: "Dashboard", icon: House },
  { label: "Orders", icon: Package },
  { label: "Customers", icon: Users },
  { label: "Invoices", icon: Receipt },
  { label: "Reports", icon: ChartBar },
];

export function SidebarIconCollapse() {
  return (
    <div className="relative h-[24rem] w-full overflow-hidden rounded-lg border border-border contain-paint">
      <Sidebar.Provider defaultOpen={false} className="min-h-full">
        <Sidebar.Root collapsible="icon" className="h-full">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {NAV.map(({ label, icon: Icon }) => (
                    <Sidebar.MenuItem key={label}>
                      <Sidebar.MenuButton tooltip={label} isActive={label === "Orders"}>
                        <Icon />
                        <span>{label}</span>
                      </Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                  ))}
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Rail />
        </Sidebar.Root>
        <Sidebar.Inset>
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <Sidebar.Trigger />
            <span className="text-sm font-medium">Icon mode</span>
          </header>
          <p className="text-sm p-4 text-muted-foreground">
            Collapsed, each row keeps its icon and hovering or focusing it reveals the label as a tooltip on
            the right. Expand it and the tooltips stay hidden — the labels are already visible.
          </p>
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
