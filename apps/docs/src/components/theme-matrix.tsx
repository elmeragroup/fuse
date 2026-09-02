"use client";

// Owns a client boundary rather than state: it dots into `Dialog.Root`, a member of a
// namespace compound exported from a client module, which a server component only sees
// as an opaque client reference (docs-site.md §6).

import type { ReactElement } from "react";

import { Badge } from "@elmeragroup/ui/badge";
import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";
import { Separator } from "@elmeragroup/ui/separator";
import { ThemeScope, themeSlug } from "@elmeragroup/ui/theme";
import type { ThemeInput } from "@elmeragroup/ui/theme";

import { LEGAL_THEMES } from "../lib/theme";

const classNames = {
  grid: "not-prose m-[1.4rem_0_2rem] grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-px overflow-hidden rounded-[8px] border border-docs-line bg-docs-line",
  cell: "flex min-w-0 flex-col bg-background",
  slug: "overflow-hidden border-b border-border px-3 py-2 font-docs-mono text-[0.66rem] tracking-[0.01em] text-ellipsis whitespace-nowrap text-muted-foreground",
  surface: "flex flex-col gap-[0.55rem] p-[0.85rem_0.75rem_1rem] text-foreground",
  row: "flex flex-wrap items-center gap-[0.4rem]",
} as const;

/**
 * The whitelabel pitch grid (docs-site.md §5).
 *
 * One cell per legal permutation — twenty of them, including `elma` — each rendering the
 * same fixed set of key components inside its own `ThemeScope`. There is no density
 * axis: this is a colour grid, and the document root stays dense.
 *
 * The Dialog in every cell is load-bearing rather than decorative. An overlay portals to
 * the nearest scope element, not to `document.body`, so opening one from inside a cell
 * proves the popup lands in that cell's theme instead of the page's.
 */
function MatrixCell({ theme }: { theme: ThemeInput }): ReactElement {
  const slug = themeSlug(theme);

  return (
    <ThemeScope theme={theme} className={classNames.cell} data-theme-matrix-cell>
      <div className={classNames.slug} data-theme-slug={slug}>
        {slug}
      </div>
      <div className={classNames.surface}>
        <div className={classNames.row}>
          <Button size="sm">Bestill</Button>
          <Button size="sm" variant="outline">
            Avbryt
          </Button>
        </div>
        <div className={classNames.row}>
          <Badge>Aktiv</Badge>
          <Badge variant="secondary">Fastpris</Badge>
          <Badge variant="outline">Bedrift</Badge>
        </div>
        <Separator />
        <div className={classNames.row}>
          <Dialog.Root>
            <Dialog.Trigger render={<Button size="sm" variant="ghost" />}>Overlay</Dialog.Trigger>
            <Dialog.Content size="sm">
              <Dialog.Header>
                <Dialog.Title>{slug}</Dialog.Title>
                <Dialog.Description>
                  This popup portals into its own cell&apos;s ThemeScope, so it is painted in this cell&apos;s
                  theme rather than the page&apos;s.
                </Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Dialog.Close render={<Button size="sm" variant="outline" />}>Lukk</Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </div>
    </ThemeScope>
  );
}

export function ThemeMatrix(): ReactElement {
  return (
    <div className={classNames.grid} data-theme-matrix>
      {LEGAL_THEMES.map((theme) => (
        <MatrixCell key={themeSlug(theme)} theme={theme} />
      ))}
    </div>
  );
}
