import type { RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type { Toast as RootToast } from "@elmeragroup/fuse";
import type {
  CreateToastManagerReturnValue,
  ToastCloseProps,
  ToastManagerAddOptions,
  ToastViewportProps,
  UseToastManagerReturnValue,
} from "@elmeragroup/fuse/toast";
import * as ToastModule from "@elmeragroup/fuse/toast";
import { Toast } from "@elmeragroup/fuse/toast";

test("Toast ships from the toast entry and the root barrel", () => {
  expectTypeOf<typeof Toast>().toEqualTypeOf<typeof RootToast>();
  expectTypeOf(Toast.Provider).toBeFunction();
  expectTypeOf(Toast.Viewport).toBeFunction();
  expectTypeOf(Toast.Root).toBeFunction();
  expectTypeOf(Toast.Content).toBeFunction();
  expectTypeOf(Toast.Title).toBeFunction();
  expectTypeOf(Toast.Description).toBeFunction();
  expectTypeOf(Toast.Action).toBeFunction();
  expectTypeOf(Toast.Close).toBeFunction();
  expectTypeOf(Toast.useToastManager).toBeFunction();
  expectTypeOf(Toast.createToastManager).toBeFunction();
});

test("Positioner, Arrow, Portal and the private recipe stay off the public namespace", () => {
  expectTypeOf(Toast).not.toHaveProperty("Positioner");
  expectTypeOf(Toast).not.toHaveProperty("Arrow");
  expectTypeOf(Toast).not.toHaveProperty("Portal");
  expectTypeOf(ToastModule).not.toHaveProperty("toastVariants");
  expectTypeOf(ToastModule).not.toHaveProperty("Toaster");
});

test("Viewport container, Close label, and manager faces match the spec", () => {
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
