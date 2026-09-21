"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { CaretLeft, CaretRight } from "@elmeragroup/fuse/icons";

export function ButtonGroupNested() {
  return (
    <ButtonGroup.Root aria-label="Pagination">
      <ButtonGroup.Root aria-label="Pages">
        <Button variant="outline" size="sm">
          1
        </Button>
        <Button variant="outline" size="sm">
          2
        </Button>
        <Button variant="outline" size="sm">
          3
        </Button>
        <Button variant="outline" size="sm">
          4
        </Button>
        <Button variant="outline" size="sm">
          5
        </Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root aria-label="Step">
        <Button variant="outline" size="icon-sm" aria-label="Previous">
          <CaretLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next">
          <CaretRight />
        </Button>
      </ButtonGroup.Root>
    </ButtonGroup.Root>
  );
}
