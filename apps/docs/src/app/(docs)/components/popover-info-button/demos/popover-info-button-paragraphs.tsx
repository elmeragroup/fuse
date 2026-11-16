"use client";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonParagraphs() {
  return (
    <div>
      Grid rent{" "}
      <PopoverInfoButton label="About grid rent">
        <p>The grid rent is the fee you pay for using the electricity grid.</p>
        <p>It is set by the network operator and billed with your consumption.</p>
      </PopoverInfoButton>
    </div>
  );
}
