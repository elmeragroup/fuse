"use client";

import { Button } from "@elmeragroup/ui/button";
import { Toast } from "@elmeragroup/ui/toast";

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
  return (
    <Toast.Provider>
      <ActionButton />
      <Toast.Viewport />
    </Toast.Provider>
  );
}
