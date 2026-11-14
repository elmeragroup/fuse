"use client";

import { Popover } from "@elmeragroup/fuse/popover";
import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonTitle() {
  return (
    <div>
      Grid rent{" "}
      <PopoverInfoButton label="About grid rent">
        <Popover.Header>
          <Popover.Title>What is grid rent?</Popover.Title>
          <Popover.Description>
            The fee you pay for using the electricity grid. It is set by the network operator and billed on
            top of the electricity price.
          </Popover.Description>
        </Popover.Header>
      </PopoverInfoButton>
    </div>
  );
}
