"use client";

import { Button } from "@elmeragroup/fuse/button";
import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";

export function CheckboxCardRightContent() {
  return (
    <CheckboxGroup name="addons" label="Add-ons">
      <CheckboxCard
        value="insurance"
        title="Insurance"
        description="Covers everything."
        rightContent={
          <Button type="button" size="sm" variant="outline">
            Details
          </Button>
        }
      />
    </CheckboxGroup>
  );
}
