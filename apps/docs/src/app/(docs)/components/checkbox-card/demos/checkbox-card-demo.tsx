"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardDemo() {
  return (
    <CheckboxGroup label="Add-ons">
      <CheckboxCard value="insurance" title="Insurance" description="Covers theft and water damage." />
    </CheckboxGroup>
  );
}
