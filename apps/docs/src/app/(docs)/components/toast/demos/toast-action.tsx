"use client";

import { useRef } from "react";

import { Toast } from "@elmeragroup/fuse/toast";

function DeleteButton() {
  const toastManager = Toast.useToastManager();

  return (
    <button
      type="button"
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
    </button>
  );
}

export function ToastAction() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    // `container` and `absolute` keep the stack inside this preview. An app renders one
    // viewport, fixed to the window.
    <div ref={viewportRef} className="max-w-sm relative min-h-[28rem] w-full">
      <Toast.Provider>
        <DeleteButton />
        <Toast.Viewport
          container={viewportRef}
          className="sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full"
        />
      </Toast.Provider>
    </div>
  );
}
