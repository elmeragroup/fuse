"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";

export function ButtonGroupText() {
  return (
    <ButtonGroup.Root aria-label="Meter ID">
      <ButtonGroup.Text>735 999 123</ButtonGroup.Text>
      <Button variant="outline">Copy</Button>
    </ButtonGroup.Root>
  );
}
