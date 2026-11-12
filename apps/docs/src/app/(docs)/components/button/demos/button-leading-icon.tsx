"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Plus } from "@elmeragroup/fuse/icons";

export function ButtonLeadingIcon() {
  return (
    <Button>
      <Plus data-icon="inline-start" />
      New project
    </Button>
  );
}
