import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { User } from "@elmeragroup/fuse/icons";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { BrandWordmark } from "../../brand/brand-wordmark";
import { useCopy } from "../../copy/copy";

/**
 * The site's header: the brand's logo, the main menu as a Fuse NavigationMenu, and the sign-in
 * and order actions. The logo is the brand's one-ink wordmark, so it reads on every scheme.
 *
 * @param props.brand - The brand the site wears.
 * @returns The header, filling its section.
 */
export function SiteHeader({ brand }: { readonly brand: BrandCode }): ReactElement {
  const { site } = useCopy().claudeBuilds;
  return (
    <header className="flex h-full items-center gap-8 border-b border-border bg-background px-10 text-foreground">
      <BrandWordmark brand={brand} />
      <NavigationMenu.Root aria-label={site.navLabel}>
        <NavigationMenu.List>
          {site.nav.map((label) => (
            <NavigationMenu.Item key={label}>
              <NavigationMenu.Link href={`#${label}`} className="whitespace-nowrap">
                {label}
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          ))}
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost">
          <User />
          {site.signIn}
        </Button>
        <Button>{site.order}</Button>
      </div>
    </header>
  );
}
