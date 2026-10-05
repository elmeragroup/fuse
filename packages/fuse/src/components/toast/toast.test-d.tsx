import type { RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  CreateToastManagerReturnValue,
  ToastCloseProps,
  ToastManagerAddOptions,
  ToastViewportProps,
  UseToastManagerReturnValue,
} from "@elmeragroup/fuse/toast";
import { Toast } from "@elmeragroup/fuse/toast";

test("Viewport container, Close label, and manager faces match the public API", () => {
  expectTypeOf<ToastViewportProps["container"]>().toEqualTypeOf<
    HTMLElement | RefObject<HTMLElement | null> | undefined
  >();
  expectTypeOf<ToastCloseProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ToastManagerAddOptions["type"]>().toEqualTypeOf<
    "error" | "info" | "success" | "warning" | "loading" | undefined
  >();
  expectTypeOf<ToastManagerAddOptions["priority"]>().toEqualTypeOf<"low" | "high" | undefined>();

  expectTypeOf<UseToastManagerReturnValue>().toHaveProperty("toasts");
  expectTypeOf<CreateToastManagerReturnValue>().not.toHaveProperty("toasts");

  const manager = Toast.createToastManager();
  expectTypeOf(manager.add).toBeFunction();
  expectTypeOf(manager.update).toBeFunction();
  expectTypeOf(manager.close).toBeFunction();
  expectTypeOf(manager.promise).toBeFunction();
  expectTypeOf(manager).not.toHaveProperty("toasts");

  void manager.promise(Promise.resolve(1), { success: "Saved", error: "Failed" });
  void manager.promise(Promise.resolve(1), {
    loading: "Saving…",
    success: (count) => ({ type: "warning", description: `${count} warnings` }),
    error: (cause) => cause.message,
  });
  // @ts-expect-error success is required
  void manager.promise(Promise.resolve(1), { loading: "Saving…", error: "Failed" });
  // @ts-expect-error error is required
  void manager.promise(Promise.resolve(1), { loading: "Saving…", success: "Saved" });

  const container: RefObject<HTMLElement | null> = { current: null };
  const _tree = (
    <Toast.Provider toastManager={manager} limit={3} timeout={5000}>
      <Toast.Viewport container={container} />
      <Toast.Close label="Dismiss" />
    </Toast.Provider>
  );

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Toast.Root as="section" toast={{ id: "x" }} />;
  // @ts-expect-error locale is provider-only
  const _noLocale = <Toast.Close locale="nb-NO" />;
});
