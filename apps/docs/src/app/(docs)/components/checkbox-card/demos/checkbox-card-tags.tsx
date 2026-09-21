"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardTags() {
  return (
    <CheckboxGroup name="addons" label="Add-ons">
      <CheckboxCard value="insurance" title="Insurance" description="Covers everything." tags={["Popular"]}>
        Includes glass and roadside as standard.
      </CheckboxCard>
    </CheckboxGroup>
  );
}
