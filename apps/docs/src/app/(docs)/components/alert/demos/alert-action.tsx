"use client";

import { useState } from "react";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertAction() {
  const [retried, setRetried] = useState(false);

  return (
    <Alert.Root variant="warning" onAction={() => setRetried(true)} actionLabel="Retry">
      <Alert.Title>Sync delayed</Alert.Title>
      <Alert.Description>
        {retried ? "Retry requested." : "Facility data is more than an hour old."}
      </Alert.Description>
    </Alert.Root>
  );
}
