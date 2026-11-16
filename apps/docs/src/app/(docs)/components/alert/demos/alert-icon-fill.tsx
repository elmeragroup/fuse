"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertIconFill() {
  return (
    <p className="flex items-center gap-2">
      <Alert.Icon variant="success" weight="fill" />
      Meter reading received
    </p>
  );
}
