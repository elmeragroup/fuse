"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { CloudArrowUp, Upload } from "@elmeragroup/fuse/icons";

export function ButtonCustomPendingIndicator() {
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isUploading) return;
    const timer = window.setTimeout(() => setIsUploading(false), 1800);
    return () => window.clearTimeout(timer);
  }, [isUploading]);

  return (
    <Button
      variant="outline"
      isPending={isUploading}
      pendingIndicator={<CloudArrowUp className="animate-pulse" />}
      onClick={() => setIsUploading(true)}>
      <Upload data-icon="inline-start" />
      {isUploading ? "Uploading" : "Upload file"}
    </Button>
  );
}
