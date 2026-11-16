"use client";

import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardRightContent() {
  return (
    <CheckboxGroup label="Add-ons">
      <CheckboxCard
        value="insurance"
        title="Insurance"
        description="Covers theft and water damage."
        rightContent={
          <a href="#insurance-terms" className="text-sm text-primary underline underline-offset-4">
            Terms
          </a>
        }
      />
    </CheckboxGroup>
  );
}
