"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowRight, MagnifyingGlass } from "@elmeragroup/fuse/icons";

export function ButtonSizes() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="default">
          <MagnifyingGlass data-icon="inline-start" />
          Default
        </Button>
        <Button size="xs">
          <MagnifyingGlass data-icon="inline-start" />
          Extra small
        </Button>
        <Button size="sm">
          <MagnifyingGlass data-icon="inline-start" />
          Small
        </Button>
        <Button size="lg">
          Large
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" aria-label="Search">
          <MagnifyingGlass />
        </Button>
        <Button size="icon-xs" aria-label="Search extra small">
          <MagnifyingGlass />
        </Button>
        <Button size="icon-sm" aria-label="Search small">
          <MagnifyingGlass />
        </Button>
        <Button size="icon-lg" aria-label="Search large">
          <MagnifyingGlass />
        </Button>
        <p className="text-sm">
          Inline
          <Button size="icon-inline" aria-label="Search inline">
            <MagnifyingGlass />
          </Button>
          action
        </p>
      </div>
    </div>
  );
}
