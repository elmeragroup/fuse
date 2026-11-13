"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowSquareOut } from "@elmeragroup/fuse/icons";

export function ButtonAsLink() {
  return (
    <Button variant="outline" nativeButton={false} render={<a href="https://www.w3.org/WAI/ARIA/apg/" />}>
      Accessibility guide
      <ArrowSquareOut data-icon="inline-end" />
    </Button>
  );
}
