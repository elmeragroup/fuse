"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";

import { HOME_PAGE, staticPagesIn } from "../../../lib/pages";
import type { StaticPage } from "../../../lib/pages";
import { COLOR_SCHEME_LABELS } from "../../../lib/theme";
import { ComponentShowcase, MenuCardText } from "./component-showcase";
import { QUICK_START } from "./landing-facts";
import { useLandingTheme } from "./landing-theme";
import { SingleToggle } from "./product-parts";

const landingNav = tv({
  slots: {
    bar: "pt-safe-top backdrop-blur-md sticky top-0 z-20 border-b border-border bg-background/80 backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-background",
    inner: "sm:px-6 max-w-landing mx-auto flex h-16 w-full items-center gap-8 px-4 lg:px-12",
    wordmark:
      "text-base font-semibold flex items-center gap-2.5 rounded-md text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    mark: "size-5",
    // Below md the menu and the CTA do not fit in one bar; below lg the scheme switch moves to
    // the footer to leave the menu room.
    menu: "md:flex hidden flex-none",
    panel: "w-2xl m-0 grid list-none grid-cols-2 gap-1 p-0",
    end: "ml-auto flex items-center gap-4",
    version: "text-xs hidden font-mono text-muted-foreground lg:inline",
    scheme: "hidden lg:inline-flex",
  },
});

const styles = landingNav();

/** Light, dark or the operating system's choice, under the same reveal as a brand change. */
export function SchemeSwitch(): ReactElement {
  const { colorScheme, changeColorScheme } = useLandingTheme();

  return (
    <SingleToggle
      label="Colour scheme"
      size="sm"
      options={COLOR_SCHEMES}
      labels={COLOR_SCHEME_LABELS}
      value={colorScheme}
      onValueChange={changeColorScheme}
    />
  );
}

type MenuPage = Pick<StaticPage, "href" | "label" | "description">;

/** One page as a panel row: its title over its one-line description. */
function MenuCard({ page }: { page: MenuPage }): ReactElement {
  return (
    <li>
      <NavigationMenu.Link render={<Link href={page.href} />}>
        <MenuCardText title={page.label} description={page.description} />
      </NavigationMenu.Link>
    </li>
  );
}

/** The two page menus, in nav order; Components follows with its live showcase. */
const PAGE_MENUS: readonly { label: string; pages: readonly MenuPage[] }[] = [
  { label: "Docs", pages: [{ ...HOME_PAGE, label: "Overview" }, ...staticPagesIn("overview")] },
  { label: "Handbook", pages: staticPagesIn("handbook") },
];

export function LandingNav(): ReactElement {
  return (
    <header className={styles.bar()}>
      <div className={styles.inner()}>
        <Link href="/" className={styles.wordmark()}>
          <ElmeraGroupLogo variant="mark" className={styles.mark()} aria-hidden />
          Fuse
        </Link>
        <NavigationMenu.Root aria-label="Primary" className={styles.menu()}>
          <NavigationMenu.List>
            {PAGE_MENUS.map((menu) => (
              <NavigationMenu.Item key={menu.label}>
                <NavigationMenu.Trigger>{menu.label}</NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <ul className={styles.panel()}>
                    {menu.pages.map((page) => (
                      <MenuCard key={page.href} page={page} />
                    ))}
                  </ul>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            ))}
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <ComponentShowcase />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
        <div className={styles.end()}>
          <span className={styles.version()}>v1.0</span>
          <span className={styles.scheme()}>
            <SchemeSwitch />
          </span>
          <Button size="sm" render={<Link href={QUICK_START.href} />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}
