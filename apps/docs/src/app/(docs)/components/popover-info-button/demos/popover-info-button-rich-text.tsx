"use client";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonRichText() {
  return (
    <div>
      Meter number{" "}
      <PopoverInfoButton label="About the meter number">
        <strong>The meter number</strong> is printed on the front of your electricity meter.{" "}
        <a href="#meters">Read more about meters</a>.
      </PopoverInfoButton>
    </div>
  );
}
