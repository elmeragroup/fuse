"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardExtraContent() {
  return (
    <CheckboxGroup label="Add-ons">
      <CheckboxCard value="insurance" title="Insurance" description="Covers theft and water damage.">
        <p className="text-sm text-muted-foreground">From 49 kr a month.</p>
      </CheckboxCard>
    </CheckboxGroup>
  );
}
