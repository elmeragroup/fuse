"use client";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

export function NavigationMenuAlignEnd() {
  return (
    <NavigationMenu.Root aria-label="Main" align="end">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Customers</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul className="grid w-64 gap-1">
              <li>
                <NavigationMenu.Link href="#electricity">Electricity</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#solar">Solar panels</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#charging">Home charging</NavigationMenu.Link>
              </li>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#support">Support</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
