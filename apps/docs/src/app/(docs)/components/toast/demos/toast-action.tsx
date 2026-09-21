"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toast } from "@elmeragroup/fuse/toast";

function ActionButton() {
  const toastManager = Toast.useToastManager();

  return (
    <Button
      variant="outline"
      onClick={() =>
        toastManager.add({
          title: "Invoice deleted",
          description: "You can restore it for a short time.",
          actionProps: {
            children: "Undo",
            onClick: () => {
              toastManager.add({ type: "success", title: "Invoice restored" });
            },
          },
        })
      }>
      Delete invoice
    </Button>
  );
}

export function ToastAction() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider>
        <ActionButton />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
