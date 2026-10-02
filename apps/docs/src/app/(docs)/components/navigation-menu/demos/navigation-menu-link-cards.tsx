"use client";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

const homeLinks = [
  { href: "#spot", title: "Spot price", description: "Follow the hourly market price." },
  { href: "#fixed", title: "Fixed price", description: "Lock your price for a year." },
  { href: "#solar", title: "Solar panels", description: "Make and sell your own power." },
  { href: "#charging", title: "Home charging", description: "Charge your car while you sleep." },
] as const;

const businessLinks = [
  { href: "#contracts", title: "Power contracts", description: "Purchasing built for your load." },
  { href: "#reporting", title: "Energy reporting", description: "Usage and emissions per site." },
] as const;

export function NavigationMenuLinkCards() {
  return (
    <NavigationMenu.Root aria-label="Products">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Home</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul className="sm:grid-cols-2 grid w-[min(32rem,calc(100vw-4rem))] gap-1">
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
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Business</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul className="grid w-[min(18rem,calc(100vw-4rem))] gap-1">
              {businessLinks.map((link) => (
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
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#support">Support</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
