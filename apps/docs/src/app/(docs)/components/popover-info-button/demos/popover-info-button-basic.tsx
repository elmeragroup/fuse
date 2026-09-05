"use client";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";
import { PopoverInfoButton } from "@elmeragroup/ui/popover-info-button";

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
