"use client";

import { Button } from "@elmeragroup/ui/button";
import { Toast } from "@elmeragroup/ui/toast";

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
  return (
    <Toast.Provider>
      <StatusButtons />
      <Toast.Viewport />
    </Toast.Provider>
  );
}
