"use client";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

export function NavigationMenuLinks() {
  return (
    <NavigationMenu.Root aria-label="Account">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#overview" active>
            Overview
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#invoices">Invoices</NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#usage">Usage</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
