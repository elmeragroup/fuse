"use client";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertIconRegular() {
  return (
    <p className="flex items-center gap-2">
      <Alert.Icon variant="success" weight="regular" />
      Meter reading received
    </p>
  );
}
