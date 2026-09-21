"use client";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

const sizes = ["sm", "default", "2xl"] as const;

export function PopoverInfoButtonSizes() {
  return (
    <div className="flex flex-wrap items-center gap-6 p-16">
      {sizes.map((contentSize) => (
        <label key={contentSize} className="text-sm flex items-center gap-2">
          {contentSize}
          <PopoverInfoButton contentSize={contentSize} label={`More information (${contentSize})`}>
            {contentSize} popover. The content axis only changes max-width — the trigger stays ghost icon-sm.
          </PopoverInfoButton>
        </label>
      ))}
    </div>
  );
}
