"use client";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonContentSizeLg() {
  return (
    <div>
      Grid rent{" "}
      <PopoverInfoButton contentSize="lg">
        The grid rent is the fee you pay for using the electricity grid. The network operator sets it each
        year, and it is billed with your consumption. It has a fixed part per month and a part per kWh you
        use.
      </PopoverInfoButton>
    </div>
  );
}
