"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { CaretLeft, CaretRight } from "@elmeragroup/fuse/icons";

const PAGES = ["1", "2", "3", "4", "5"];

export function ButtonGroupNested() {
  return (
    <ButtonGroup.Root aria-label="Pagination">
      <ButtonGroup.Root aria-label="Pages">
        {PAGES.map((page) => (
          <Button key={page} variant="outline" size="sm">
            {page}
          </Button>
        ))}
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
