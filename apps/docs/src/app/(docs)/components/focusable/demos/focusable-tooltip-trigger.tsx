"use client";

import { Button } from "@elmeragroup/ui/button";
import { Focusable } from "@elmeragroup/ui/react-aria/focusable";
import { Tooltip } from "@elmeragroup/ui/tooltip";

export function FocusableTooltipTrigger() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Focusable>
              <Button variant="outline" isVisuallyDisabled aria-disabled="true">
                Closed meter
              </Button>
            </Focusable>
          }
        />
        <Tooltip.Content>This action is unavailable because the meter is already closed.</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
