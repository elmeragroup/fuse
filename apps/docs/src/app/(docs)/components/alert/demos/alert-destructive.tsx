"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertDestructive() {
  return (
    <Alert.Root variant="destructive" className="max-w-lg">
      <Alert.Title>Two meters are offline</Alert.Title>
      <Alert.Description>Billing for those sites is paused until they reconnect.</Alert.Description>
    </Alert.Root>
  );
}
