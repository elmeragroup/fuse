"use client";

import { Focusable } from "@elmeragroup/ui/react-aria/focusable";
import { Tooltip } from "@elmeragroup/ui/tooltip";

export function FocusableTooltipTrigger() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Focusable>
              <span className="cursor-help text-muted-foreground underline decoration-dotted">
                Closed meter
              </span>
            </Focusable>
          }
        />
        <Tooltip.Content>This action is unavailable because the meter is already closed.</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
