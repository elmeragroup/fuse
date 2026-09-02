"use client";

import { Button } from "@elmeragroup/ui/button";
import { House, Package, Users } from "@elmeragroup/ui/icons";
import { Sidebar } from "@elmeragroup/ui/sidebar";

function NavMenu() {
  return (
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
  );
}

export function SidebarInsetVariant() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="relative h-[20rem] w-full overflow-hidden rounded-lg border border-border contain-paint">
        <Sidebar.Provider className="min-h-full">
          <Sidebar.Root variant="inset" className="h-full">
            <Sidebar.Content>
              <Sidebar.Group>
                <Sidebar.GroupLabel>Inset rail</Sidebar.GroupLabel>
                <Sidebar.GroupContent>
                  <NavMenu />
                </Sidebar.GroupContent>
              </Sidebar.Group>
            </Sidebar.Content>
            <Sidebar.Rail />
          </Sidebar.Root>
          <Sidebar.Inset>
            <header className="flex h-12 items-center gap-2 px-3">
              <Sidebar.Trigger />
              <span className="text-sm font-medium">Inset content</span>
            </header>
            <p className="text-sm px-4 text-muted-foreground">
              The Inset picks up margins, rounding and a shadow from the rail's peer attributes; collapsing
              the rail keeps a small left margin.
            </p>
          </Sidebar.Inset>
        </Sidebar.Provider>
      </div>

      <div className="relative h-[16rem] w-full overflow-hidden rounded-lg border border-border">
        <Sidebar.Provider className="min-h-full">
          <Sidebar.Root variant="inset" collapsible="none" className="h-full">
            <Sidebar.Header>
              <span className="text-sm font-medium px-2">Step 2 of 4</span>
            </Sidebar.Header>
            <Sidebar.Content>
              <Sidebar.Group>
                <Sidebar.GroupContent>
                  <Sidebar.Menu>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton size="sm">Customer</Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton size="sm" isActive>
                        Delivery
                      </Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton size="sm">Products</Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton size="sm">Summary</Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                  </Sidebar.Menu>
                </Sidebar.GroupContent>
              </Sidebar.Group>
            </Sidebar.Content>
          </Sidebar.Root>
          <Sidebar.Inset>
            <div className="text-sm flex flex-1 flex-col gap-3 p-4">
              <p className="font-medium">Delivery address</p>
              <p className="text-muted-foreground">
                A static wizard rail: `collapsible="none"` never toggles, but still emits the peer attributes
                the Inset styling reads.
              </p>
              <div className="mt-auto flex gap-2">
                <Button variant="outline" size="sm">
                  Back
                </Button>
                <Button size="sm">Continue</Button>
              </div>
            </div>
          </Sidebar.Inset>
        </Sidebar.Provider>
      </div>
    </div>
  );
}
