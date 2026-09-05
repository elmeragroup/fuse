"use client";

import { CheckboxGroup } from "@elmeragroup/ui/checkbox";
import { CheckboxCard } from "@elmeragroup/ui/checkbox-card";

export function CheckboxCardBasic() {
  return (
    <CheckboxGroup name="addons" label="Add-ons">
      <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />
    </CheckboxGroup>
  );
}
