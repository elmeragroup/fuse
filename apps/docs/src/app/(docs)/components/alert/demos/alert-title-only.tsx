"use client";

import { Alert } from "@elmeragroup/ui/alert";

export function AlertTitleOnly() {
  return (
    <Alert.Root variant="success">
      <Alert.Title>Changes saved</Alert.Title>
    </Alert.Root>
  );
}
