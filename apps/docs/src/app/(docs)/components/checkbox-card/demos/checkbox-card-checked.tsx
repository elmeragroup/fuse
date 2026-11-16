"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardChecked() {
  return (
    <CheckboxGroup label="Add-ons" defaultValue={["insurance"]}>
      <CheckboxCard value="insurance" title="Insurance" description="Covers theft and water damage." />
    </CheckboxGroup>
  );
}
