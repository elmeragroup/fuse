"use client";

import { Button } from "@elmeragroup/ui/button";
import { Toast } from "@elmeragroup/ui/toast";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function PromiseButtons() {
  const toastManager = Toast.useToastManager();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() =>
          void toastManager.promise(
            wait(1200).then(() => "ok"),
            {
              loading: "Saving reading…",
              success: { title: "Saved", description: "The meter reading is stored." },
              error: "Could not save the reading.",
            }
          )
        }>
        Save (success)
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          void toastManager.promise(
            wait(1200).then(() => Promise.reject(new Error("offline"))),
            {
              loading: "Saving reading…",
              success: "Saved",
              error: { title: "Could not save", description: "Check the connection and try again." },
            }
          )
        }>
        Save (error)
      </Button>
    </div>
  );
}

export function ToastPromise() {
  return (
    <Toast.Provider>
      <PromiseButtons />
      <Toast.Viewport />
    </Toast.Provider>
  );
}
