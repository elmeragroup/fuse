import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { ChartBar, Gear, House, Lightning, Receipt } from "@elmeragroup/fuse/icons";
import { Text } from "@elmeragroup/fuse/text";

import { SidebarBrandSource } from "./sidebar-brand-source";

const sidebarBoard = tv({
  slots: {
    root: "flex flex-col gap-4 p-8",
    // Layout and the sidebar roles only: the library Sidebar stays on its own page
    // (test/docs-chrome-imports.test.ts), so this is the shape of one, painted by its tokens.
    frame: "flex h-96 overflow-hidden rounded-lg border border-border",
    sidebar:
      "flex w-56 shrink-0 flex-col gap-1 border-e border-sidebar-border bg-sidebar p-2 text-sidebar-foreground",
    brand:
      "mb-2 rounded-md bg-sidebar-brand p-3 font-mono leading-(--text-xs--line-height) text-sidebar-brand-foreground",
    // The brand role's other pairing: brand text on the sidebar surface. Text sets relaxed
    // leading; the label keeps its size's own.
    group: "px-2 pt-3 pb-1 leading-(--text-xs--line-height) text-sidebar-brand",
    item: "w-full justify-start text-sidebar-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground",
    footer: "mt-auto border-t border-sidebar-border pt-2",
    main: "flex flex-1 flex-col gap-2 bg-background p-6",
    sources: "flex flex-wrap gap-x-6 gap-y-2",
  },
  variants: {
    current: {
      true: { item: "bg-sidebar-accent text-sidebar-accent-foreground" },
    },
    // The sidebar's focus ring, drawn at rest so its color shows without a focused item.
    ringed: {
      true: { item: "ring-2 ring-sidebar-ring" },
    },
  },
});

const styles = sidebarBoard();

const NAV = [
  { label: "Overview", icon: House, current: true },
  { label: "Usage", icon: ChartBar, current: false },
  { label: "Invoices", icon: Receipt, current: false },
  { label: "Agreements", icon: Lightning, current: false },
] as const;

/**
 * An app sidebar's shape painted with the `--sidebar*` roles: the surface, its text and border,
 * the current item's accent pair, the focus ring and the brand pair.
 */
export function SidebarBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <div className={styles.frame()}>
        <nav aria-label="Sidebar sample" className={styles.sidebar()}>
          <Text elementType="div" size="xs" className={styles.brand()}>
            --sidebar-brand
          </Text>
          <Text elementType="span" size="xs" weight="medium" className={styles.group()}>
            Account
          </Text>
          {NAV.map(({ label, icon: Icon, current }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              className={styles.item({ current })}
              aria-current={current ? "page" : undefined}>
              <Icon />
              {label}
            </Button>
          ))}
          <div className={styles.footer()}>
            <Button variant="ghost" size="sm" className={styles.item({ ringed: true })}>
              <Gear />
              Settings
            </Button>
          </div>
        </nav>
        <div className={styles.main()}>
          <Text weight="medium">Overview</Text>
          <Text variant="muted" size="sm">
            The page beside the sidebar, on the background role.
          </Text>
        </div>
      </div>
      <Text variant="muted" size="sm">
        Each theme composes the brand pair per scheme: an alias where the brand reads on the sidebar, a
        literal tone where it does not. An alias follows its source, so an edit to --brand reaches it; a
        literal takes an edit to the pair itself.
      </Text>
      <div className={styles.sources()}>
        <SidebarBrandSource name="sidebar-brand" />
        <SidebarBrandSource name="sidebar-brand-foreground" />
      </div>
    </div>
  );
}
