"use client";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

export function NavigationMenuBasic() {
  return (
    <NavigationMenu.Root aria-label="Main">
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
          <NavigationMenu.Trigger>Business</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul className="grid w-72 gap-1">
              <li>
                <NavigationMenu.Link href="#contracts">Power contracts</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#reporting">Energy reporting</NavigationMenu.Link>
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
