"use client";

// Owns a client boundary rather than state: it dots into namespace compounds (`Dialog.Root`,
// `Tabs.Root`, `Sidebar.*`) exported from client modules, which a server component only sees
// as opaque client references (docs-site.md §6).

import type { ReactElement, ReactNode } from "react";

import { Badge } from "@elmeragroup/ui/badge";
import { Button } from "@elmeragroup/ui/button";
import { Card } from "@elmeragroup/ui/card";
import { Dialog } from "@elmeragroup/ui/dialog";
import { House, Package, Users } from "@elmeragroup/ui/icons";
import { Pagination } from "@elmeragroup/ui/pagination";
import { Sidebar } from "@elmeragroup/ui/sidebar";
import { Skeleton } from "@elmeragroup/ui/skeleton";
import { Switch } from "@elmeragroup/ui/switch";
import { Tabs } from "@elmeragroup/ui/tabs";
import { TextField } from "@elmeragroup/ui/text-field";
import { Tooltip } from "@elmeragroup/ui/tooltip";

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/**
 * A scratch surface, not a demo pipeline: enough of the library to see a theme coordinate
 * and a source edit land. Swap components in and out freely — nothing reads this file.
 */
export function Gallery(): ReactElement {
  return (
    <>
      <Section title="Button">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button isPending>Pending</Button>
      </Section>

      <Section title="Badge">
        <Badge>Aktiv</Badge>
        <Badge variant="outline">Outline</Badge>
      </Section>

      <Section title="TextField + Switch">
        <TextField label="Email" description="Work address preferred." placeholder="name@example.com" />
        <Switch aria-label="Notifications" defaultChecked />
      </Section>

      <Section title="Card">
        <Card.Root className="w-80">
          <Card.Header>
            <Card.Title>March usage</Card.Title>
            <Card.Description>Estimated consumption for the period.</Card.Description>
          </Card.Header>
          <Card.Content>
            <p>1 240 kWh across two meters.</p>
          </Card.Content>
          <Card.Footer>
            <Skeleton className="h-4 w-24" />
          </Card.Footer>
        </Card.Root>
      </Section>

      <Section title="Tabs">
        <Tabs.Root defaultValue="account">
          <Tabs.List>
            <Tabs.Trigger value="account">Account</Tabs.Trigger>
            <Tabs.Trigger value="password">Password</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="account">Invoice 10041 is billed to the account holder.</Tabs.Content>
          <Tabs.Content value="password">Password changes take effect on the next sign-in.</Tabs.Content>
        </Tabs.Root>
      </Section>

      <Section title="Overlays">
        <Dialog.Root>
          <Dialog.Trigger render={<Button variant="outline" />}>Open dialog</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Meter details</Dialog.Title>
              <Dialog.Description>Readings for this address.</Dialog.Description>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog.Root>
        <Tooltip.Root>
          <Tooltip.Trigger render={<Button variant="ghost" />}>Hover me</Tooltip.Trigger>
          <Tooltip.Content>Localized chrome comes from the provider above.</Tooltip.Content>
        </Tooltip.Root>
      </Section>

      <Section title="Pagination (dictionary strings)">
        <Pagination.Root>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous href="#previous" />
            </Pagination.Item>
            <Pagination.Item>
              <Pagination.Link href="#1" isActive>
                1
              </Pagination.Link>
            </Pagination.Item>
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
            <Pagination.Item>
              <Pagination.Next href="#next" />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination.Root>
      </Section>

      <Section title="Sidebar">
        <div className="relative h-72 w-full overflow-hidden rounded-lg border border-border contain-paint">
          <Sidebar.Provider className="min-h-full">
            <Sidebar.Root collapsible="icon" className="h-full">
              <Sidebar.Content>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
                  <Sidebar.Menu>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton tooltip="Dashboard">
                        <House />
                        <span>Dashboard</span>
                      </Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton tooltip="Orders" isActive>
                        <Package />
                        <span>Orders</span>
                      </Sidebar.MenuButton>
                      <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton tooltip="Customers">
                        <Users />
                        <span>Customers</span>
                      </Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                  </Sidebar.Menu>
                </Sidebar.Group>
              </Sidebar.Content>
              <Sidebar.Rail />
            </Sidebar.Root>
            <Sidebar.Inset>
              <div className="flex h-12 items-center gap-2 border-b border-border px-3">
                <Sidebar.Trigger />
                <span className="text-sm">Inset</span>
              </div>
            </Sidebar.Inset>
          </Sidebar.Provider>
        </div>
      </Section>
    </>
  );
}
