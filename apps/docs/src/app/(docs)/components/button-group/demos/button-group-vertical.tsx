"use client";

import { Button } from "@elmeragroup/ui/button";
import { ButtonGroup } from "@elmeragroup/ui/button-group";
import { CaretDown, CaretUp } from "@elmeragroup/ui/icons";

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
