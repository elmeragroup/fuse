"use client";

import { GridList, GridListItem } from "@elmeragroup/fuse/react-aria/grid-list";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function GridListSelection() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <GridList
        aria-label="Meters"
        selectionMode="multiple"
        selectionBehavior="toggle"
        disabledKeys={["trondheim"]}>
        <GridListItem id="oslo">Oslo meter 735999123</GridListItem>
        <GridListItem id="bergen">Bergen meter 735999456</GridListItem>
        <GridListItem id="trondheim">Trondheim meter 735999789</GridListItem>
      </GridList>
    </UiProviders>
  );
}
