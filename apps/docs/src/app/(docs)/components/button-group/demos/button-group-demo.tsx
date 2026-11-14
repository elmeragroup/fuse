"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";

export function ButtonGroupDemo() {
  return (
    <ButtonGroup.Root aria-label="Message actions">
      <Button variant="outline">Archive</Button>
      <Button variant="outline">Snooze</Button>
      <Button variant="outline">Report</Button>
    </ButtonGroup.Root>
  );
}
