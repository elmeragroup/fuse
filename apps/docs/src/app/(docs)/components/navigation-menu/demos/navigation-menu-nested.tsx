"use client";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

const homeLinks = [
  { href: "#spot", title: "Spot price", description: "Follow the hourly market price." },
  { href: "#fixed", title: "Fixed price", description: "Lock your price for a year." },
] as const;

const chargingLinks = [
  { href: "#home-charger", title: "Home charger", description: "A wallbox fitted by our installers." },
  { href: "#smart-charging", title: "Smart charging", description: "Charge in the cheapest hours." },
  { href: "#housing", title: "Housing associations", description: "Shared charging for every space." },
] as const;

export function NavigationMenuNested() {
  return (
    <NavigationMenu.Root aria-label="Products">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Home</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul className="grid w-[min(18rem,calc(100vw-4rem))] gap-1">
              {homeLinks.map((link) => (
                <li key={link.href}>
                  <NavigationMenu.Link href={link.href}>
                    <span className="flex flex-col gap-1 py-1">
                      <span className="font-medium">{link.title}</span>
                      <span className="text-muted-foreground">{link.description}</span>
                    </span>
                  </NavigationMenu.Link>
                </li>
              ))}
              <li>
                <NavigationMenu.Root orientation="vertical" side="right" align="end">
                  <NavigationMenu.List>
                    <NavigationMenu.Item>
                      <NavigationMenu.Trigger>
                        <span className="flex flex-col gap-1">
                          <span>Electric car</span>
                          <span className="font-normal text-muted-foreground">
                            Charging at home and away.
                          </span>
                        </span>
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content>
                        <ul className="grid w-[min(18rem,calc(100vw-4rem))] gap-1">
                          {chargingLinks.map((link) => (
                            <li key={link.href}>
                              <NavigationMenu.Link href={link.href}>
                                <span className="flex flex-col gap-1 py-1">
                                  <span className="font-medium">{link.title}</span>
                                  <span className="text-muted-foreground">{link.description}</span>
                                </span>
                              </NavigationMenu.Link>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  </NavigationMenu.List>
                </NavigationMenu.Root>
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
