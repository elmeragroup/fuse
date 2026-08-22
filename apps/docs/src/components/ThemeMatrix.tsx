"use client";

import type { ReactElement } from "react";

import { Badge } from "@elmeragroup/ui/badge";
import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";
import { Separator } from "@elmeragroup/ui/separator";
import { ThemeScope, themeSlug } from "@elmeragroup/ui/theme";
import type { ThemeInput } from "@elmeragroup/ui/theme";

import { LEGAL_THEMES } from "../lib/theme";
import "./ThemeMatrix.css";

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
    <ThemeScope theme={theme} className="MatrixCell">
      <div className="MatrixSlug">{slug}</div>
      <div className="MatrixSurface">
        <div className="MatrixRow">
          <Button size="sm">Bestill</Button>
          <Button size="sm" variant="outline">
            Avbryt
          </Button>
        </div>
        <div className="MatrixRow">
          <Badge>Aktiv</Badge>
          <Badge variant="secondary">Fastpris</Badge>
          <Badge variant="outline">Bedrift</Badge>
        </div>
        <Separator />
        <div className="MatrixRow">
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
    <div className="MatrixGrid">
      {LEGAL_THEMES.map((theme) => (
        <MatrixCell key={themeSlug(theme)} theme={theme} />
      ))}
    </div>
  );
}
