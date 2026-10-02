"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowRight } from "@elmeragroup/fuse/icons";

/**
 * A label that may break onto more lines. The size's fixed height becomes a minimum, the
 * vertical inset is half that height minus one line (`1lh`) and the 1px border, and the text
 * may wrap and centres. A one-line label measures exactly like a fixed button, and each
 * further line adds one line height. Swap the `--control-h-md` token for the size in use.
 */
const WRAP_MD = "h-auto min-h-(--control-h-md) py-[calc((var(--control-h-md)-1lh)/2-1px)] text-center whitespace-normal";
const WRAP_SM = "h-auto min-h-(--control-h-sm) py-[calc((var(--control-h-sm)-1lh)/2-1px)] text-center whitespace-normal";

export function ButtonWrap() {
  return (
    <div className="flex max-w-56 flex-col items-start gap-2">
      <Button className={WRAP_MD}>Send the contract to my email and continue</Button>
      <Button className={WRAP_SM} variant="outline" size="sm">
        Keep the current plan and remind me again next month
        <ArrowRight data-icon="inline-end" />
      </Button>
      <Button className={WRAP_MD}>Save</Button>
    </div>
  );
}
