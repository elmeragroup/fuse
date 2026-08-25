"use client";

import { Button } from "@elmeragroup/ui/button";
import { ButtonGroup } from "@elmeragroup/ui/button-group";

const VARIANTS = ["default", "outline", "secondary", "ghost"] as const;

export function ButtonGroupBasic() {
  return (
    <div className="flex flex-col gap-3">
      {VARIANTS.map((variant) => (
        <ButtonGroup.Root key={variant} aria-label={`${variant} actions`}>
          <Button variant={variant}>Archive</Button>
          <Button variant={variant}>Snooze</Button>
          <Button variant={variant}>Report</Button>
        </ButtonGroup.Root>
      ))}
    </div>
  );
}
