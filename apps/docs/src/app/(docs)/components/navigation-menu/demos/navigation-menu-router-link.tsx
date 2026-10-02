"use client";

import NextLink from "next/link";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

export function NavigationMenuRouterLink() {
  return (
    <NavigationMenu.Root aria-label="Navigation components">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Link render={<NextLink href="/components/navigation-menu" />} active>
            Navigation Menu
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link render={<NextLink href="/components/breadcrumb" />}>
            Breadcrumb
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link render={<NextLink href="/components/pagination" />}>
            Pagination
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
