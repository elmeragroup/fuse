"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertSuccess() {
  return (
    <Alert.Root variant="success" className="max-w-lg">
      <Alert.Title>All meters reporting</Alert.Title>
      <Alert.Description>Last sync completed two minutes ago.</Alert.Description>
    </Alert.Root>
  );
}
