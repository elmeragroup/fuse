"use client";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonDemo() {
  return (
    <div>
      Grid rent{" "}
      <PopoverInfoButton>
        The grid rent is the fee you pay for using the electricity grid. It is set by the network operator and
        billed with your consumption.
      </PopoverInfoButton>
    </div>
  );
}
