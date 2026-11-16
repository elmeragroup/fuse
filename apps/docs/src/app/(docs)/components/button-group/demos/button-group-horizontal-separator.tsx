"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";

export function ButtonGroupHorizontalSeparator() {
  return (
    <ButtonGroup.Root orientation="vertical" aria-label="Export">
      <Button variant="secondary">Export CSV</Button>
      <ButtonGroup.Separator orientation="horizontal" />
      <Button variant="secondary">Export PDF</Button>
    </ButtonGroup.Root>
  );
}
