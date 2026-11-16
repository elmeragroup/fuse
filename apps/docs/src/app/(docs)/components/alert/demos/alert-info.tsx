"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertInfo() {
  return (
    <Alert.Root variant="info" className="max-w-lg">
      <Alert.Title>New prices from 1 November</Alert.Title>
      <Alert.Description>The change shows on your next invoice.</Alert.Description>
    </Alert.Root>
  );
}
