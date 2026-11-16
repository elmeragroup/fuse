"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardMuted() {
  return (
    <CheckboxGroup label="Add-ons">
      <CheckboxCard
        value="insurance"
        title="Insurance"
        description="Covers theft and water damage."
        variant="muted"
      />
    </CheckboxGroup>
  );
}
