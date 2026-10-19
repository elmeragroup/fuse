"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";
import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";
import { Link } from "@elmeragroup/fuse/react-aria/link";

export function PopoverInfoButtonRichText() {
  return (
    <div className="flex flex-col gap-6">
      <Field.Root>
        <Field.Label>
          Meter number
          <PopoverInfoButton label="About the meter number">
            <strong>The meter number</strong> is printed on the front of your electricity meter. Read more
            about meters <Link href="#meters">here</Link>.
          </PopoverInfoButton>
        </Field.Label>
        <Input />
      </Field.Root>
      <Field.Root>
        <Field.Label>
          Grid rent
          <PopoverInfoButton label="About grid rent">
            <p>The grid rent is the fee you pay for using the electricity grid.</p>
            <p>It is set by the network operator and billed with your consumption.</p>
          </PopoverInfoButton>
        </Field.Label>
        <Input />
      </Field.Root>
    </div>
  );
}
