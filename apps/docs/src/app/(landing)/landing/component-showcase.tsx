"use client";

import type { ReactElement, ReactNode } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { Meter } from "@elmeragroup/fuse/meter";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { Switch } from "@elmeragroup/fuse/switch";

import { COMPONENT_PAGES } from "../../../generated/component-pages";
import { componentBySlug } from "../../../lib/nav";
import { HOME_PAGE } from "../../../lib/pages";

const componentShowcase = tv({
  slots: {
    // Fixed-width list beside a fluid stage; the popup caps the whole panel at the viewport.
    layout: "w-2xl flex",
    list: "w-60 flex-none border-e border-border pe-2",
    entry: "flex flex-col gap-1 py-1",
    entryTitle: "font-medium text-foreground",
    entryLede: "text-muted-foreground",
    viewport: "flex-1",
    // One fixed height for every stage, so swapping components never resizes the popup. The
    // page background sets it off the popup in both schemes; dark `muted` matches the popup.
    stage: "ms-2 flex h-80 items-center justify-center rounded-md border border-border bg-background p-6",
    stageRow: "flex flex-wrap items-center justify-center gap-2",
    stageField: "w-full",
    all: "mt-2 border-t border-border pt-2",
  },
});

const styles = componentShowcase();

/**
 * The components the menu shows, each with a stage small enough to run inside the popup. None
 * opens an overlay of its own, so nothing on a stage portals out of the menu.
 */
const SHOWCASE = [
  {
    slug: "button",
    stage: (
      <div className={styles.stageRow()}>
        <Button>Save reading</Button>
        <Button variant="ghost">Cancel</Button>
      </div>
    ),
  },
  {
    slug: "switch",
    stage: (
      <Field.Root orientation="horizontal" className={styles.stageField()}>
        <Field.Content>
          <Field.Label>Price alerts</Field.Label>
          <Field.Description>Tell me when the spot price spikes.</Field.Description>
        </Field.Content>
        <Switch defaultChecked />
      </Field.Root>
    ),
  },
  {
    slug: "meter",
    stage: (
      <div className={styles.stageField()}>
        <Meter label="Monthly budget" value={864} maxValue={1200} valueLabel="NOK 864 of 1 200" />
      </div>
    ),
  },
  {
    slug: "badge",
    stage: (
      <div className={styles.stageRow()}>
        <Badge variant="success">Paid</Badge>
        <Badge variant="info">Due 15 Oct</Badge>
        <Badge variant="destructive">Overdue</Badge>
      </div>
    ),
  },
] as const satisfies readonly { slug: string; stage: ReactNode }[];

const ENTRIES = SHOWCASE.map(({ slug, stage }) => {
  const component = componentBySlug(slug);
  if (component === undefined) {
    throw new Error(`component showcase: no component page for "${slug}"`);
  }
  return { slug, stage, title: component.title, lede: component.lede, href: `/components/${slug}` };
});

/**
 * The Components panel of the landing nav: an inline submenu that swaps a live stage beside
 * the list as each component is hovered or focused, and a link to every component under it.
 */
export function ComponentShowcase(): ReactElement {
  return (
    <>
      <NavigationMenu.Root orientation="vertical" inline defaultValue={SHOWCASE[0].slug}>
        <div className={styles.layout()}>
          <div className={styles.list()}>
            <NavigationMenu.List>
              {ENTRIES.map((entry) => (
                <NavigationMenu.Item key={entry.slug} value={entry.slug}>
                  {/* A link, so a click opens the docs; hover and focus still swap the stage. */}
                  <NavigationMenu.Trigger nativeButton={false} render={<Link href={entry.href} />}>
                    <span className={styles.entry()}>
                      <span className={styles.entryTitle()}>{entry.title}</span>
                      <span className={styles.entryLede()}>{entry.lede}</span>
                    </span>
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <div className={styles.stage()}>{entry.stage}</div>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              ))}
            </NavigationMenu.List>
          </div>
          <NavigationMenu.Viewport className={styles.viewport()} />
        </div>
      </NavigationMenu.Root>
      <div className={styles.all()}>
        <NavigationMenu.Link render={<Link href={HOME_PAGE.href} />}>
          {`View all ${String(COMPONENT_PAGES.length)} components`}
        </NavigationMenu.Link>
      </div>
    </>
  );
}
