import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { ROLE_TILES } from "../../lib/color-roles";
import { PairTile } from "./pair-tile";

const pairsBoard = tv({
  slots: {
    root: "flex flex-col gap-8 p-8",
    section: "flex flex-col gap-3",
    tiles: "grid grid-cols-4 gap-x-3 gap-y-5",
  },
});

const styles = pairsBoard();

const GROUPS = [
  { title: "Surfaces", tiles: ROLE_TILES.surfaces },
  { title: "Actions", tiles: ROLE_TILES.actions },
] as const;

/**
 * Every surface and action role with its foreground, and its soft form beside it, each marked
 * with the contrast of the colors the browser resolved here. A text-grade pair needs 4.5:1;
 * `feature-foreground` is decorative, so its pair shows the ratio and never fails.
 */
export function PairsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <Text variant="muted">Select a pair to edit its role. Its knob opens in the inspector.</Text>
      {GROUPS.map(({ title, tiles }) => (
        <section key={title} className={styles.section()} aria-label={title}>
          <Heading level={2} size="lg">
            {title}
          </Heading>
          <div className={styles.tiles()}>
            {tiles.map((tile) => (
              <PairTile key={tile.role} tile={tile} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
