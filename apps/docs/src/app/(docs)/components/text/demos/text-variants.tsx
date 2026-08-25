"use client";

import { Text } from "@elmeragroup/ui/text";

export function TextVariants() {
  return (
    <div className="flex flex-col gap-2">
      <Text variant="default">Order 10041 is ready for review.</Text>
      <Text variant="foreground">Meter 735999123 is the primary supply.</Text>
      <Text variant="primary">Open the settlement for March.</Text>
      <Text variant="secondary">Secondary contact is billed separately.</Text>
      <Text variant="brand">Elmera Group customer number 104221.</Text>
      <Text variant="muted">Last reading received 3 April.</Text>
      <Text variant="inherit">Inherits the surrounding colour.</Text>
      <Text variant="success">Order 10041 delivered.</Text>
      <Text variant="destructive">Order 10044 cancelled.</Text>
    </div>
  );
}
