"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";
import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

export function PopoverInfoButtonBasic() {
  return (
    <Field.Root>
      <Field.Label>
        Grid rent
        <PopoverInfoButton>
          The grid rent is the fee you pay for using the electricity grid. It is set by the network operator
          and billed with your consumption.
        </PopoverInfoButton>
      </Field.Label>
      <Input />
    </Field.Root>
  );
}
