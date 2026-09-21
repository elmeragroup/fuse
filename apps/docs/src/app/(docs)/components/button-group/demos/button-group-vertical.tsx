"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { CaretDown, CaretUp } from "@elmeragroup/fuse/icons";

export function ButtonGroupVertical() {
  return (
    <ButtonGroup.Root orientation="vertical" aria-label="Media controls">
      <Button variant="outline" size="icon" aria-label="Increase">
        <CaretUp />
      </Button>
      <Button variant="outline" size="icon" aria-label="Decrease">
        <CaretDown />
      </Button>
    </ButtonGroup.Root>
  );
}
