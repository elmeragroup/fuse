"use client";

import { useState } from "react";

import { House, Package, Users } from "@elmeragroup/fuse/icons";
import { Sidebar, useSidebar } from "@elmeragroup/fuse/sidebar";

const VIEWS = [
  { label: "Dashboard", icon: House },
  { label: "Orders", icon: Package },
  { label: "Customers", icon: Users },
] as const;

type View = (typeof VIEWS)[number]["label"];

function ViewportNote({ view }: { view: View }) {
  const { isMobile } = useSidebar();
  return (
    <p className="text-sm p-4 text-muted-foreground">
      {isMobile
        ? `Showing ${view}. Below 768px the rail is an 18rem Sheet: open it from the trigger, dismiss it with Escape, the scrim or its close button, or pick a view to close it.`
        : "Narrow the browser below 768px to see the Sheet branch take over from the desktop rail."}
    </p>
  );
}

export function SidebarMobileSheet() {
  const [view, setView] = useState<View>("Orders");
  // The host holds the phone Sheet's state, so picking a view can close it.
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <div className="relative h-[20rem] w-full overflow-hidden rounded-lg border border-border">
      <Sidebar.Provider bounds="container" openMobile={openMobile} onOpenMobileChange={setOpenMobile}>
        <Sidebar.Root>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {VIEWS.map(({ label, icon: Icon }) => (
                    <Sidebar.MenuItem key={label}>
                      <Sidebar.MenuButton
                        isActive={view === label}
                        onClick={() => {
                          setView(label);
                          setOpenMobile(false);
                        }}>
                        <Icon />
                        <span>{label}</span>
                      </Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                  ))}
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
          <ViewportNote view={view} />
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
