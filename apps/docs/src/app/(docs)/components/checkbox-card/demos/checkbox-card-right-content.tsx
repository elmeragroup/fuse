"use client";

import { Button } from "@elmeragroup/ui/button";
import { CheckboxGroup } from "@elmeragroup/ui/checkbox";
import { CheckboxCard } from "@elmeragroup/ui/checkbox-card";

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
