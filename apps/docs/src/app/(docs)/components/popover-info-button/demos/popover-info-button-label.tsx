"use client";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonLabel() {
  return (
    <div>
      Grid rent{" "}
      <PopoverInfoButton label="About grid rent">
        The grid rent is the fee you pay for using the electricity grid.
      </PopoverInfoButton>
    </div>
  );
}
