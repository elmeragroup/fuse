"use client";

import { useState } from "react";

import { Alert } from "@elmeragroup/fuse/alert";

export function AlertStatus() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-lg flex flex-col items-start gap-3">
      <button type="button" onClick={() => setSaved(true)}>
        Save draft
      </button>
      <Alert.Root role="status" variant="info" className="w-full">
        <Alert.Title>{saved ? "Draft saved" : "Unsaved changes"}</Alert.Title>
      </Alert.Root>
    </div>
  );
}
