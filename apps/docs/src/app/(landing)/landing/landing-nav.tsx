"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";
import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { useLandingTheme } from "./landing-theme";

const landingNav = tv({
  slots: {
    bar: "pt-safe-top backdrop-blur-md sticky top-0 z-20 border-b border-border bg-background/80 backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-background",
    inner: "sm:px-6 max-w-landing mx-auto flex h-16 w-full items-center gap-8 px-4 lg:px-12",
    wordmark:
      "text-base font-semibold flex items-center gap-2.5 rounded-md text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    mark: "size-5",
    links: "text-sm md:flex hidden items-center gap-1",
    link: "rounded-md px-2.5 py-1.5 text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
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

const LINKS = [
  { href: "/components/button", label: "Components" },
  { href: "/quick-start", label: "Quick start" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/releases", label: "Releases" },
] as const;

export function LandingNav(): ReactElement {
  return (
    <header className={styles.bar()}>
      <div className={styles.inner()}>
        <Link href="/landing" className={styles.wordmark()}>
          <ElmeraGroupLogo variant="mark" className={styles.mark()} aria-hidden />
          Fuse
        </Link>
        <nav aria-label="Primary" className={styles.links()}>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link()}>
              {link.label}
            </Link>
          ))}
        </nav>
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
