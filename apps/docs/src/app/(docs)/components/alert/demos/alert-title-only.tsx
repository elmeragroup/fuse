"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertTitleOnly() {
  return (
    <Alert.Root variant="success" className="max-w-lg">
      <Alert.Title>Changes saved</Alert.Title>
    </Alert.Root>
  );
}
