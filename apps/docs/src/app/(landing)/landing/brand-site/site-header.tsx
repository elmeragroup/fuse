import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { BrandLogo, ElmeraGroupLogo, List, MagnifyingGlass, User } from "@elmeragroup/fuse/icons";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { Sheet } from "@elmeragroup/fuse/sheet";

import { BrandWordmark } from "../brand-wordmark";
import type { Site, SiteHeader as SiteHeaderConfig } from "./site-model";
import { SiteButton } from "./site-parts";

const siteHeader = tv({
  slots: {
    header:
      "backdrop-blur-md sticky top-0 z-10 border-b border-border bg-background/90 backdrop-saturate-150",
    utility:
      "@5xl:block landing-dark:bg-card landing-dark:text-card-foreground hidden bg-secondary text-secondary-foreground",
    utilityInner: "text-xs max-w-6xl @3xl:px-10 mx-auto flex h-9 w-full items-center gap-5 px-5",
    utilityLink:
      "aria-[current=page]:font-medium inline-flex h-full items-center gap-1.5 border-b-2 border-transparent text-current/75 no-underline outline-none hover:text-current focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:border-current aria-[current=page]:text-current",
    utilityIcon: "size-3.5",
    utilityEnd: "ml-auto flex h-full items-center gap-5",
    bar: "max-w-6xl @3xl:gap-6 @3xl:px-10 mx-auto flex h-16 w-full items-center gap-4 px-4",
    logo: "flex h-10 shrink-0 items-center rounded-sm text-brand no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    logoArt: "@3xl:h-7 flex h-6 *:flex *:*:h-full *:h-full *:*:w-auto",
    wordmark: "text-foreground",
    utilitySegments: "flex h-full items-stretch gap-5",
    segments: "@5xl:flex hidden h-16 items-stretch gap-5",
    segment:
      "text-sm aria-[current=page]:font-semibold inline-flex items-center border-b-2 border-transparent text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:border-primary aria-[current=page]:text-foreground",
    navSingle: "@5xl:flex hidden flex-1 justify-center",
    navRow: "@5xl:block hidden",
    navRowInner: "max-w-6xl @3xl:px-8 mx-auto flex h-12 w-full items-center px-3",
    trigger: "gap-2 whitespace-nowrap",
    panel: "w-md m-0 grid list-none grid-cols-1 gap-1 p-0",
    panelLink: "flex flex-col items-start gap-0.5 py-2",
    panelTitle: "font-medium text-foreground",
    panelText: "text-muted-foreground",
    end: "ml-auto flex shrink-0 items-center gap-2",
    wide: "@5xl:inline-flex hidden",
    menuTrigger: "@5xl:hidden -mr-2",
    sheetBody: "flex flex-col gap-6",
    sheetGroup: "flex flex-col gap-1",
    sheetHeading: "text-xs font-medium px-2 pb-1 text-muted-foreground",
    sheetLink:
      "text-base flex min-h-11 items-center gap-3 rounded-md px-2 text-foreground no-underline outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
    sheetSegments: "flex gap-2",
    sheetActions: "flex flex-col gap-2 border-t border-border pt-6",
  },
});

const styles = siteHeader();

/** The logo artwork the config names, each one level inside the slot that sizes its SVG. */
function SiteLogoArt({ site }: { site: Site }): ReactElement {
  switch (site.logo) {
    case "elmera-group":
      return (
        <span>
          <ElmeraGroupLogo title={site.name} />
        </span>
      );
    case "brand":
      return <BrandLogo brand={site.brand} title={site.name} />;
    case "wordmark":
      // One ink: the brand colour can be the one a light header needs to avoid, as yellow is.
      return (
        <span className={styles.wordmark()}>
          <BrandWordmark brand={site.brand} size="site" />
        </span>
      );
  }
}

/** The site's logo, linking to the top of the site. */
function SiteLogo({ site }: { site: Site }): ReactElement {
  return (
    <a href="#top" className={styles.logo()}>
      <span className={styles.logoArt()}>
        <SiteLogoArt site={site} />
      </span>
    </a>
  );
}

/** The audience tabs, in the utility row or beside the logo; the first one is the current page. */
function Segments({
  header,
  place,
}: {
  header: SiteHeaderConfig;
  place: "utility" | "bar";
}): ReactElement | null {
  if (header.segments === undefined) {
    return null;
  }
  return (
    <nav
      aria-label={header.segments.label}
      className={place === "utility" ? styles.utilitySegments() : styles.segments()}>
      {header.segments.items.map((item, index) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={index === 0 ? "page" : undefined}
          className={place === "utility" ? styles.utilityLink() : styles.segment()}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/** The primary nav as a Fuse NavigationMenu: panels of described links, and plain links. */
function SiteNav({ header }: { header: SiteHeaderConfig }): ReactElement {
  return (
    <NavigationMenu.Root aria-label={header.nav.label}>
      <NavigationMenu.List>
        {header.nav.items.map((item) => (
          <NavigationMenu.Item key={item.label}>
            {item._tag === "Menu" ? (
              <>
                <NavigationMenu.Trigger className={styles.trigger()}>
                  {item.icon === undefined ? null : <item.icon />}
                  {item.label}
                </NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <ul className={styles.panel()}>
                    {item.links.map((link) => (
                      <li key={link.href}>
                        <NavigationMenu.Link href={link.href} className={styles.panelLink()}>
                          <span className={styles.panelTitle()}>{link.label}</span>
                          <span className={styles.panelText()}>{link.description}</span>
                        </NavigationMenu.Link>
                      </li>
                    ))}
                  </ul>
                </NavigationMenu.Content>
              </>
            ) : (
              <NavigationMenu.Link href={item.href} className={styles.trigger()}>
                {item.icon === undefined ? null : <item.icon />}
                {item.label}
              </NavigationMenu.Link>
            )}
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

/**
 * Below the window's `@5xl` width (64rem), which a 1024px viewport's window is, search, the
 * tabs, the nav, the utility links and the actions fold into this Sheet.
 */
function MenuSheet({ header }: { header: SiteHeaderConfig }): ReactElement {
  return (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="ghost" className={styles.menuTrigger()} />}>
        <List />
        {header.menu}
      </Sheet.Trigger>
      <Sheet.Content size="sm">
        <Sheet.Header>
          <Sheet.Title>{header.menu}</Sheet.Title>
        </Sheet.Header>
        <Sheet.Body className={styles.sheetBody()}>
          {header.search === undefined ? null : (
            <a href="#sok" className={styles.sheetLink()}>
              <MagnifyingGlass />
              {header.search}
            </a>
          )}
          {header.segments === undefined ? null : (
            <div className={styles.sheetSegments()}>
              {header.segments.items.map((item, index) => (
                <Button
                  key={item.href}
                  size="sm"
                  variant={index === 0 ? "secondary" : "ghost"}
                  aria-current={index === 0 ? "page" : undefined}
                  render={<a href={item.href} />}
                  nativeButton={false}>
                  {item.label}
                </Button>
              ))}
            </div>
          )}
          <nav aria-label={header.nav.label} className={styles.sheetBody()}>
            {header.nav.items.map((item) =>
              item._tag === "Menu" ? (
                <div key={item.label} className={styles.sheetGroup()}>
                  <p className={styles.sheetHeading()}>{item.label}</p>
                  {item.links.map((link) => (
                    <a key={link.href} href={link.href} className={styles.sheetLink()}>
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : (
                <a key={item.label} href={item.href} className={styles.sheetLink()}>
                  {item.icon === undefined ? null : <item.icon />}
                  {item.label}
                </a>
              )
            )}
          </nav>
          {header.utility === undefined ? null : (
            <div className={styles.sheetGroup()}>
              {header.utility.map((link) => (
                <a key={link.href} href={link.href} className={styles.sheetLink()}>
                  {link.label}
                </a>
              ))}
            </div>
          )}
          <div className={styles.sheetActions()}>
            {header.signIn === undefined ? null : (
              <SiteButton link={header.signIn}>
                <User />
              </SiteButton>
            )}
            <SiteButton link={header.cta} variant="outline" />
          </div>
        </Sheet.Body>
      </Sheet.Content>
    </Sheet.Root>
  );
}

/**
 * The site's header: an optional utility row with the audience tabs, then the logo, the nav and
 * the actions. A `stacked` header gives the nav a row of its own, as Fjordkraft's does. A header
 * with a utility row signs in from that row, as Telinet's does, which leaves the bar room for the
 * nav, search and the call to action at every window width.
 */
export function SiteHeader({ site }: { site: Site }): ReactElement {
  const { header } = site;
  const utilityRow = header.utility !== undefined;
  return (
    <header className={styles.header()}>
      {utilityRow ? (
        <div className={styles.utility()}>
          <div className={styles.utilityInner()}>
            <Segments header={header} place="utility" />
            <div className={styles.utilityEnd()}>
              {header.utility.map((link) => (
                <a key={link.href} href={link.href} className={styles.utilityLink()}>
                  {link.label}
                </a>
              ))}
              {header.signIn === undefined ? null : (
                <a href={header.signIn.href} className={styles.utilityLink()}>
                  <User aria-hidden className={styles.utilityIcon()} />
                  {header.signIn.label}
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div className={styles.bar()}>
        <SiteLogo site={site} />
        {utilityRow ? null : <Segments header={header} place="bar" />}
        {header.layout === "single" ? (
          <div className={styles.navSingle()}>
            <SiteNav header={header} />
          </div>
        ) : null}
        <div className={styles.end()}>
          {header.search === undefined ? null : (
            <Button variant="ghost" className={styles.wide()} render={<a href="#sok" />} nativeButton={false}>
              <MagnifyingGlass />
              {header.search}
            </Button>
          )}
          <SiteButton link={header.cta} variant="outline" className={styles.wide()} />
          {header.signIn === undefined || utilityRow ? null : (
            <SiteButton link={header.signIn} className={styles.wide()}>
              <User />
            </SiteButton>
          )}
          <MenuSheet header={header} />
        </div>
      </div>
      {header.layout === "stacked" ? (
        <div className={styles.navRow()}>
          <div className={styles.navRowInner()}>
            <SiteNav header={header} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
