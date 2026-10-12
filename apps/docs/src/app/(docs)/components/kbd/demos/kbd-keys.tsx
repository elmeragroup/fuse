"use client";

import { Kbd } from "@elmeragroup/fuse/kbd";

export function KbdKeys() {
  return (
    <p className="text-sm">
      Press <Kbd>Tab</Kbd> to move to the next field, <Kbd>Enter</Kbd> to save the reading and <Kbd>Esc</Kbd>{" "}
      to discard it.
    </p>
  );
}
