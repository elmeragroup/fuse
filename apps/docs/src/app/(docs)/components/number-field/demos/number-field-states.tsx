"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldStates() {
  return (
    <div className="flex flex-col gap-3">
      <NumberField label="Disabled" isDisabled defaultValue={4} />
      <NumberField label="Read only" isReadOnly defaultValue={8} />
      <NumberField label="Checking stock" isPending defaultValue={2} />
      <NumberField label="Verified" isSuccess defaultValue={2} />
    </div>
  );
}
