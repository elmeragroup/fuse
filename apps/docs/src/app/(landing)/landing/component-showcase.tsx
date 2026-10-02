"use client";

import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";
import { Switch } from "@elmeragroup/fuse/switch";

import { HOME_PAGE } from "../../../lib/pages";
import { FACTS, landingComponent } from "./landing-facts";
import { BudgetMeter } from "./product-parts";

const componentShowcase = tv({
  slots: {
    // Fixed-width list beside a fluid stage; the popup caps the whole panel at the viewport.
    layout: "w-2xl flex",
    list: "m-0 flex w-60 flex-none list-none flex-col gap-1 border-e border-border p-0 pe-2",
    // One fixed height for every stage, so swapping components never resizes the popup. The
    // page background sets it off the popup in both schemes; dark `muted` matches the popup.
    stage:
      "ms-2 flex h-80 flex-1 items-center justify-center rounded-md border border-border bg-background p-6",
    stageRow: "flex flex-wrap items-center justify-center gap-2",
    stageField: "w-full",
    all: "mt-2 border-t border-border pt-2",
  },
});

const styles = componentShowcase();

/** An entry row; the one whose stage shows keeps the row highlight a hover gives the others. */
const showcaseEntry = tv({
  variants: {
    shown: { true: "bg-accent text-accent-foreground" },
  },
});

const menuCard = tv({
  slots: {
    body: "flex flex-col gap-1 py-1",
    title: "font-medium text-foreground",
    description: "text-muted-foreground",
  },
});

const cardStyles = menuCard();

export type MenuCardTextProps = { title: string; description: string };

/** A panel row's title over its one-line description, for the nav's page cards and these entries. */
export function MenuCardText({ title, description }: MenuCardTextProps): ReactElement {
  return (
    <span className={cardStyles.body()}>
      <span className={cardStyles.title()}>{title}</span>
      <span className={cardStyles.description()}>{description}</span>
    </span>
  );
}

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
        <BudgetMeter />
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

const ENTRIES = SHOWCASE.map(({ slug, stage }) => ({ ...landingComponent(slug), stage }));

/**
 * The Components panel of the landing nav: a list of links to the components' docs, with a live
 * stage beside it that shows whichever entry was last hovered or focused, and a link to every
 * component under it. The stage is a visual preview like a docs demo stage, so it announces
 * nothing as it swaps; each entry's own link names the component.
 */
export function ComponentShowcase(): ReactElement {
  const [active, setActive] = useState<string>(SHOWCASE[0].slug);
  const shown = ENTRIES.find((entry) => entry.slug === active);

  return (
    <>
      <div className={styles.layout()}>
        <ul className={styles.list()}>
          {ENTRIES.map((entry) => (
            <li key={entry.slug}>
              <NavigationMenu.Link
                render={<Link href={entry.href} />}
                className={showcaseEntry({ shown: entry.slug === active })}
                onPointerEnter={() => setActive(entry.slug)}
                onFocus={() => setActive(entry.slug)}>
                <MenuCardText title={entry.title} description={entry.lede} />
              </NavigationMenu.Link>
            </li>
          ))}
        </ul>
        <div className={styles.stage()}>{shown?.stage}</div>
      </div>
      <div className={styles.all()}>
        <NavigationMenu.Link render={<Link href={HOME_PAGE.href} />}>
          {`View all ${String(FACTS.components)} components`}
        </NavigationMenu.Link>
      </div>
    </>
  );
}
