"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowRight } from "@elmeragroup/fuse/icons";

export function ButtonWrap() {
  return (
    <div className="flex max-w-56 flex-col items-start gap-2">
      <Button wrap>Send the contract to my email and continue</Button>
      <Button wrap variant="outline" size="sm">
        Keep the current plan and remind me again next month
        <ArrowRight data-icon="inline-end" />
      </Button>
      <Button wrap>Save</Button>
    </div>
  );
}
