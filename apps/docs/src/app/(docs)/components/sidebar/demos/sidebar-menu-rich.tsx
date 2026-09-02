"use client";

import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";
import { DotsThree, Package, Receipt, Users } from "@elmeragroup/ui/icons";
import { Sidebar } from "@elmeragroup/ui/sidebar";

export function SidebarMenuRich() {
  return (
    <div className="relative h-[30rem] w-full overflow-hidden rounded-lg border border-border contain-paint">
      <Sidebar.Provider className="min-h-full">
        <Sidebar.Root className="h-full">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Sales</Sidebar.GroupLabel>
              <Sidebar.GroupAction aria-label="Add a sales view">
                <DotsThree />
              </Sidebar.GroupAction>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton isActive>
                      <Package />
                      <span>Orders</span>
                    </Sidebar.MenuButton>
                    <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                    <Sidebar.MenuSub>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton href="#open" isActive>
                          <span>Open</span>
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton href="#shipped">
                          <span>Shipped</span>
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton href="#archived" size="sm">
                          <span>Archived (small)</span>
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    </Sidebar.MenuSub>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>
                      <Users />
                      <span>Customers</span>
                    </Sidebar.MenuButton>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger
                        render={<Sidebar.MenuAction showOnHover aria-label="Customer actions" />}>
                        <DotsThree />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content side="right" align="start">
                        <DropdownMenu.Item>Import customers</DropdownMenu.Item>
                        <DropdownMenu.Item>Export list</DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item>Hide from sidebar</DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>
                      <Receipt />
                      <span>Invoices</span>
                    </Sidebar.MenuButton>
                    <Sidebar.MenuBadge>3</Sidebar.MenuBadge>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
            <Sidebar.Separator />
            <Sidebar.Group>
              <Sidebar.GroupLabel>Loading</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {["a", "b", "c", "d", "e"].map((row) => (
                    <Sidebar.MenuItem key={row}>
                      <Sidebar.MenuSkeleton showIcon />
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
            <span className="text-sm font-medium">Rich menu</span>
          </header>
          <p className="text-sm p-4 text-muted-foreground">
            Hover the Customers row to reveal its action; the dropdown it opens keeps the action visible while
            open.
          </p>
        </Sidebar.Inset>
      </Sidebar.Provider>
    </div>
  );
}
