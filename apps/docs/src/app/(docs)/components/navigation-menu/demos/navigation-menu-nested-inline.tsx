"use client";

import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

const audiences = [
  {
    value: "homes",
    label: "Homes",
    hint: "Power for your household.",
    title: "Electricity that fits how you live",
    links: [
      { href: "#spot", title: "Spot price", description: "Follow the hourly market price." },
      { href: "#fixed", title: "Fixed price", description: "Lock your price for a year." },
    ],
  },
  {
    value: "cabins",
    label: "Cabins",
    hint: "Keep the lights on while you are away.",
    title: "Heat and power for your cabin",
    links: [
      { href: "#remote", title: "Remote control", description: "Turn the heat up before you arrive." },
      { href: "#cabin-solar", title: "Cabin solar", description: "Off-grid power for the weekend." },
    ],
  },
  {
    value: "businesses",
    label: "Businesses",
    hint: "Purchasing and reporting for every site.",
    title: "Energy for companies of every size",
    links: [
      { href: "#contracts", title: "Power contracts", description: "Purchasing built for your load." },
      { href: "#reporting", title: "Energy reporting", description: "Usage and emissions per site." },
    ],
  },
] as const;

export function NavigationMenuNestedInline() {
  return (
    <NavigationMenu.Root aria-label="Products">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Electricity</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Root orientation="vertical" inline defaultValue="homes">
              {/* Side by side from the sm breakpoint; stacked, list above panel, below it. */}
              <div className="sm:grid-cols-[15rem_minmax(0,1fr)] grid w-[min(40rem,calc(100vw-4rem))]">
                <div className="sm:border-e sm:border-b-0 sm:pe-2 border-b border-border pb-2">
                  <NavigationMenu.List>
                    {audiences.map((audience) => (
                      <NavigationMenu.Item key={audience.value} value={audience.value}>
                        <NavigationMenu.Trigger>
                          <span className="flex flex-col gap-1 py-1">
                            <span className="font-medium">{audience.label}</span>
                            <span className="text-muted-foreground">{audience.hint}</span>
                          </span>
                        </NavigationMenu.Trigger>
                        <NavigationMenu.Content>
                          <div className="flex flex-col gap-2 p-2">
                            <p className="font-medium m-0 px-2">{audience.title}</p>
                            <ul className="grid gap-1">
                              {audience.links.map((link) => (
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
                          </div>
                        </NavigationMenu.Content>
                      </NavigationMenu.Item>
                    ))}
                  </NavigationMenu.List>
                </div>
                <NavigationMenu.Viewport className="min-h-64" />
              </div>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#support">Support</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
