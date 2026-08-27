"use client";

import { GridList, GridListItem } from "@elmeragroup/ui/react-aria/grid-list";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function GridListEmpty() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <GridList
        aria-label="Meters"
        className="min-h-40"
        items={[]}
        renderEmptyState={() => "No meters match this filter."}>
        {() => <GridListItem>unused</GridListItem>}
      </GridList>
    </UiProviders>
  );
}
