"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";

export function ButtonGroupSeparator() {
  return (
    <ButtonGroup.Root aria-label="Text alignment">
      <Button variant="secondary">Left</Button>
      <ButtonGroup.Separator />
      <Button variant="secondary">Centre</Button>
      <ButtonGroup.Separator />
      <Button variant="secondary">Right</Button>
    </ButtonGroup.Root>
  );
}
