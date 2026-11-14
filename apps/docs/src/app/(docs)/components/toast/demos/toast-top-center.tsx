"use client";

import { useRef } from "react";

import { Toast } from "@elmeragroup/fuse/toast";

function SaveButton() {
  const toastManager = Toast.useToastManager();

  return (
    <button
      type="button"
      onClick={() => toastManager.add({ title: "Draft saved", description: "You can finish it later." })}>
      Save draft
    </button>
  );
}

export function ToastTopCenter() {
  const viewportRef = useRef<HTMLDivElement>(null);
  return (
    // `container` and `absolute` keep the stack inside this preview. An app renders one
    // viewport, fixed to the window.
    <div ref={viewportRef} className="relative flex min-h-[36rem] w-full items-center justify-center">
      <Toast.Provider>
        <SaveButton />
        <Toast.Viewport
          container={viewportRef}
          placement="top-center"
          className="sm:max-w-[calc(100%-4rem)] absolute"
        />
      </Toast.Provider>
    </div>
  );
}
