"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowRight } from "@elmeragroup/fuse/icons";

/**
 * A label that may break onto more lines. The size's fixed height becomes a minimum, the
 * vertical inset is half that height minus one line (`1lh`) and the 1px border, the lines
 * centre, and the text may wrap. A one-line label measures exactly like a plain button, and
 * each further line adds one line height. Swap the `--control-h-md` token for the size in use.
 * This file alone may restyle Button's spacing and spell the two inset calcs; the override
 * sits in `.oxlintrc.json`, since the recipe is the documented exception to that rule.
 */
export function ButtonWrap() {
  return (
    <div className="flex max-w-56 flex-col items-start gap-2">
      <Button className="h-auto min-h-(--control-h-md) py-[calc((var(--control-h-md)-1lh)/2-1px)] text-center whitespace-normal">
        Send the contract to my email and continue
      </Button>
      <Button
        className="h-auto min-h-(--control-h-sm) py-[calc((var(--control-h-sm)-1lh)/2-1px)] text-center whitespace-normal"
        variant="outline"
        size="sm">
        Keep the current plan and remind me again next month
        <ArrowRight data-icon="inline-end" />
      </Button>
      <div className="flex gap-2">
        <Button variant="outline">Cancel</Button>
        <Button className="h-auto min-h-(--control-h-md) py-[calc((var(--control-h-md)-1lh)/2-1px)] text-center whitespace-normal">
          Save
        </Button>
      </div>
    </div>
  );
}
