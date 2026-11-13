"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowRight } from "@elmeragroup/fuse/icons";

export function ButtonTrailingIcon() {
  return (
    <Button variant="outline">
      Continue
      <ArrowRight data-icon="inline-end" />
    </Button>
  );
}
