"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertWarning() {
  return (
    <Alert.Root variant="warning" className="max-w-lg">
      <Alert.Title>Sync delayed</Alert.Title>
      <Alert.Description>Facility data is more than an hour old.</Alert.Description>
    </Alert.Root>
  );
}
