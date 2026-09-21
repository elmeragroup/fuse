"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

function StatusButtons() {
  const toastManager = Toast.useToastManager();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => toastManager.add({ title: "Draft saved", description: "No status chrome." })}>
        Neutral
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toastManager.add({
            type: "info",
            title: "Syncing",
            description: "Prices refresh every 15 minutes.",
          })
        }>
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() => toastManager.add({ type: "success", title: "Saved", description: "Changes stored." })}>
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toastManager.add({
            type: "warning",
            title: "Low credit",
            description: "Top up before the next invoice.",
          })
        }>
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toastManager.add({ type: "error", title: "Could not save", description: "Try again." })
        }>
        Error
      </Button>
    </div>
  );
}

export function ToastStatuses() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider>
        <StatusButtons />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
