"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardVariants() {
  return (
    <CheckboxGroup name="addons" label="Add-ons">
      <CheckboxCard value="insurance" title="Insurance" description="Default surface." />
      <CheckboxCard value="muted" title="Muted plan" description="Muted surface." variant="muted" />
      <CheckboxCard value="disabled" title="Disabled plan" description="Cannot be selected." isDisabled />
    </CheckboxGroup>
  );
}
