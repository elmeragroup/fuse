"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowRight, Plus } from "@elmeragroup/fuse/icons";

/**
 * A wordmark as a default SVGR and SVGO pipeline leaves it: `width` and `height`, but no
 * `viewBox`, because SVGO's `removeViewBox` preset strips it.
 */
function Wordmark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} width="56" height="14" xmlns="http://www.w3.org/2000/svg">
      <rect width="14" height="14" rx="3" fill="currentColor" />
      <rect x="18" y="3" width="38" height="8" rx="4" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function ButtonIcons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline">
        <Plus data-icon="inline-start" />
        16px by default
      </Button>
      <Button variant="outline">
        A size-* class opts out
        <ArrowRight data-icon="inline-end" className="size-6" />
      </Button>
      <Button variant="outline">
        Clipped at 16px
        <Wordmark />
      </Button>
      <Button variant="outline">
        Keeps its own size
        <Wordmark className="size-auto" />
      </Button>
    </div>
  );
}
