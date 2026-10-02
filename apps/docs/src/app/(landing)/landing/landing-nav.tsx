"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { HOME_PAGE, staticPagesIn } from "../../../lib/pages";
import type { StaticPage } from "../../../lib/pages";
import { ComponentShowcase } from "./component-showcase";
import { useLandingTheme } from "./landing-theme";

const landingNav = tv({
  slots: {
    bar: "pt-safe-top backdrop-blur-md sticky top-0 z-20 border-b border-border bg-background/80 backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-background",
    inner: "sm:px-6 max-w-landing mx-auto flex h-16 w-full items-center gap-8 px-4 lg:px-12",
    wordmark:
      "text-base font-semibold flex items-center gap-2.5 rounded-md text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    mark: "size-5",
    // The bar has no room for the menu on phones.
    menu: "md:flex hidden flex-none",
    panel: "w-2xl m-0 grid list-none grid-cols-2 gap-1 p-0",
    card: "flex flex-col gap-1 py-1",
    cardTitle: "font-medium text-foreground",
    cardDescription: "text-muted-foreground",
    end: "ml-auto flex items-center gap-4",
    version: "text-xs hidden font-mono text-muted-foreground lg:inline",
    scheme: "sm:inline-flex hidden",
  },
});

const styles = landingNav();

const SCHEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} as const satisfies Record<ColorScheme, string>;

/** Light, dark or the operating system's choice, under the same reveal as a brand change. */
export function SchemeSwitch(): ReactElement {
  const { colorScheme, changeColorScheme } = useLandingTheme();

  return (
    <ToggleGroup.Root
      aria-label="Colour scheme"
      variant="outline"
      size="sm"
      spacing={0}
      value={[colorScheme]}
      onValueChange={(next) => {
        const picked = COLOR_SCHEMES.find((scheme) => scheme === next[0]);
        if (picked !== undefined) {
          changeColorScheme(picked);
        }
      }}>
      {COLOR_SCHEMES.map((scheme) => (
        <ToggleGroup.Item key={scheme} value={scheme}>
          {SCHEME_LABELS[scheme]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

type MenuLink = { href: string; title: string; description: string };

/** One titled link with its one-line description, as a panel row. */
function MenuCard({ link }: { link: MenuLink }): ReactElement {
  return (
    <li>
      <NavigationMenu.Link render={<Link href={link.href} />}>
        <span className={styles.card()}>
          <span className={styles.cardTitle()}>{link.title}</span>
          <span className={styles.cardDescription()}>{link.description}</span>
        </span>
      </NavigationMenu.Link>
    </li>
  );
}

function pageLinks(pages: readonly StaticPage[]): readonly MenuLink[] {
  return pages.map((page) => ({ href: page.href, title: page.label, description: page.description }));
}

const DOCS_LINKS: readonly MenuLink[] = [
  { href: HOME_PAGE.href, title: "Overview", description: HOME_PAGE.description },
  ...pageLinks(staticPagesIn("overview")),
];

const HANDBOOK_LINKS = pageLinks(staticPagesIn("handbook"));

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
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <ul className={styles.panel()}>
                  {DOCS_LINKS.map((link) => (
                    <MenuCard key={link.href} link={link} />
                  ))}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Handbook</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <ul className={styles.panel()}>
                  {HANDBOOK_LINKS.map((link) => (
                    <MenuCard key={link.href} link={link} />
                  ))}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
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
          <Button size="sm" render={<Link href="/quick-start" />} nativeButton={false}>
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}
