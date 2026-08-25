"use client";

import { Button } from "@elmeragroup/ui/button";
import { Info } from "@elmeragroup/ui/icons";
import { Tooltip } from "@elmeragroup/ui/tooltip";

export function TooltipBasic() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<Button variant="ghost" size="icon" aria-label="Add to library" />}>
          <Info aria-hidden />
        </Tooltip.Trigger>
        <Tooltip.Content>Add to library</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
