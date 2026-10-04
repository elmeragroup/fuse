"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { BrandLogo, ElmeraGroupLogo, List, MagnifyingGlass, User } from "@elmeragroup/fuse/icons";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { Sheet } from "@elmeragroup/fuse/sheet";

import { BrandWordmark } from "../brand-wordmark";
import { useSideOverlay } from "../window-side";
import type { Site, SiteHeader as SiteHeaderConfig } from "./site-model";
import { SiteButton } from "./site-parts";

const siteHeader = tv({
  slots: {
    header:
      "backdrop-blur-md sticky top-0 z-10 border-b border-border bg-background/90 backdrop-saturate-150",
    utility:
      "landing-dark:bg-card landing-dark:text-card-foreground hidden bg-secondary text-secondary-foreground",
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
    segments: "hidden h-16 items-stretch gap-5",
    segment:
      "text-sm aria-[current=page]:font-semibold inline-flex items-center border-b-2 border-transparent text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:border-primary aria-[current=page]:text-foreground",
    navSingle: "hidden flex-1 justify-center",
    navRow: "hidden",
    navRowInner: "max-w-6xl @3xl:px-8 mx-auto flex h-12 w-full items-center px-3",
    trigger: "gap-2 whitespace-nowrap",
    panel: "w-md m-0 grid list-none grid-cols-1 gap-1 p-0",
    panelLink: "flex flex-col items-start gap-0.5 py-2",
    panelTitle: "font-medium text-foreground",
    panelText: "text-muted-foreground",
    end: "ml-auto flex shrink-0 items-center gap-2",
    wide: "hidden",
    menuTrigger: "-mr-2",
    sheetBody: "flex flex-col gap-6",
    sheetGroup: "flex flex-col gap-1",
    sheetHeading: "text-xs font-medium px-2 pb-1 text-muted-foreground",
    sheetLink:
      "text-base flex min-h-11 items-center gap-3 rounded-md px-2 text-foreground no-underline outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
    sheetSegments: "flex gap-2",
    sheetActions: "flex flex-col gap-2 border-t border-border pt-6",
  },
  variants: {
    // A header that fits shows its rows from the window's `@5xl` width (64rem) up, which a 1024px
    // viewport's window is not; one that overflows keeps everything in the menu Sheet. Keyed by
    // `HeaderFit`'s tag.
    fit: {
      Fits: {
        utility: "@5xl:block",
        segments: "@5xl:flex",
        navSingle: "@5xl:flex",
        navRow: "@5xl:block",
        wide: "@5xl:inline-flex",
        menuTrigger: "@5xl:hidden",
      },
      Overflows: {},
    },
  },
});

/** The header's slots for its current fit, computed once in `SiteHeader`. */
type HeaderStyles = ReturnType<typeof siteHeader>;

/**
 * Whether the header's rows fit the window, so it shows them, or overflow it, so it keeps them in
 * the menu Sheet. `needs` is the header width an overflowing header measured it would take to
 * fit; the hidden rows cannot be measured until they show again.
 */
type HeaderFit = { readonly _tag: "Fits" } | { readonly _tag: "Overflows"; readonly needs: number };

/**
 * Folds the header into its menu Sheet whenever a row's content is wider than the row, measured
 * rather than keyed to a width: the copy's width depends on the font the platform draws, and
 * Roboto falls back to a wider face on Linux than on macOS. It measures before the first paint,
 * then again whenever the header or a row's part resizes, as when a web font swaps in. A folded
 * header unfolds once the header is as wide as it measured it needs.
 */
function useHeaderFit(header: RefObject<HTMLElement | null>): HeaderFit {
  const [fit, setFit] = useState<HeaderFit>({ _tag: "Fits" });

  useLayoutEffect(() => {
    const element = header.current;
    if (element === null) {
      return undefined;
    }
    const rows = [...element.querySelectorAll<HTMLElement>("[data-header-row]")];
    const measure = () => {
      const width = element.clientWidth;
      setFit((current) => {
        if (current._tag === "Overflows") {
          return width >= current.needs ? { _tag: "Fits" } : current;
        }
        const overflow = Math.max(0, ...rows.map((row) => row.scrollWidth - row.clientWidth));
        return overflow > 0 ? { _tag: "Overflows", needs: width + overflow } : current;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const part of rows.flatMap((row) => [...row.children])) {
      observer.observe(part);
    }
    return () => {
      observer.disconnect();
    };
  }, [header]);

  return fit;
}

/** The logo artwork the config names, each one level inside the slot that sizes its SVG. */
function SiteLogoArt({ site, styles }: { site: Site; styles: HeaderStyles }): ReactElement {
  switch (site.logo) {
    case "elmera-group":
      // The group's teal is a light-scheme ink that sinks into a dark header, so the lockup draws
      // in the header's own foreground, as the wordmarks do.
      return (
        <span className={styles.wordmark()}>
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
function SiteLogo({ site, styles }: { site: Site; styles: HeaderStyles }): ReactElement {
  return (
    <a href="#top" className={styles.logo()}>
      <span className={styles.logoArt()}>
        <SiteLogoArt site={site} styles={styles} />
      </span>
    </a>
  );
}

/** The audience tabs, in the utility row or beside the logo; the first one is the current page. */
function Segments({
  header,
  place,
  styles,
}: {
  header: SiteHeaderConfig;
  place: "utility" | "bar";
  styles: HeaderStyles;
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
function SiteNav({ header, styles }: { header: SiteHeaderConfig; styles: HeaderStyles }): ReactElement {
  const [value, setValue] = useSideOverlay<string | null>(null);
  return (
    <NavigationMenu.Root aria-label={header.nav.label} value={value} onValueChange={setValue}>
      <NavigationMenu.List>
        {header.nav.items.map((item) => (
          <NavigationMenu.Item key={item.label} value={item.label}>
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
 * Below the window's `@5xl` width (64rem), or wherever the header overflows, search, the tabs,
 * the nav, the utility links and the actions fold into this Sheet.
 */
function MenuSheet({ header, styles }: { header: SiteHeaderConfig; styles: HeaderStyles }): ReactElement {
  const [open, setOpen] = useSideOverlay(false);
  return (
    <Sheet.Root open={open} onOpenChange={setOpen}>
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
 * nav, search and the call to action at every window width. A header whose copy overflows a row,
 * in a wider font, folds into the menu Sheet as a narrow window's does.
 */
export function SiteHeader({ site }: { site: Site }): ReactElement {
  const { header } = site;
  const utilityRow = header.utility !== undefined;
  const element = useRef<HTMLElement>(null);
  const fit = useHeaderFit(element);
  const styles = siteHeader({ fit: fit._tag });
  return (
    <header ref={element} className={styles.header()}>
      {utilityRow ? (
        <div className={styles.utility()}>
          <div data-header-row className={styles.utilityInner()}>
            <Segments header={header} place="utility" styles={styles} />
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
      <div data-header-row className={styles.bar()}>
        <SiteLogo site={site} styles={styles} />
        {utilityRow ? null : <Segments header={header} place="bar" styles={styles} />}
        {header.layout === "single" ? (
          <div className={styles.navSingle()}>
            <SiteNav header={header} styles={styles} />
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
          <MenuSheet header={header} styles={styles} />
        </div>
      </div>
      {header.layout === "stacked" ? (
        <div className={styles.navRow()}>
          <div data-header-row className={styles.navRowInner()}>
            <SiteNav header={header} styles={styles} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
