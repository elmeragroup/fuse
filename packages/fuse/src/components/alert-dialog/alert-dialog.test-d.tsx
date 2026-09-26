import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { expectTypeOf, test } from "vitest";

import type { AlertDialog as RootAlertDialog } from "@elmeragroup/fuse";
import type { AlertDialogContentProps } from "@elmeragroup/fuse/alert-dialog";
import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

test("AlertDialog ships from the alert-dialog entry and the root barrel", () => {
  expectTypeOf<typeof AlertDialog>().toEqualTypeOf<typeof RootAlertDialog>();
  expectTypeOf(AlertDialog.Root).toBeFunction();
  expectTypeOf(AlertDialog.Trigger).toBeFunction();
  expectTypeOf(AlertDialog.Content).toBeFunction();
});

test("the public namespace is three parts and Content omits showCloseButton", () => {
  expectTypeOf(AlertDialog).not.toHaveProperty("Portal");
  expectTypeOf(AlertDialog).not.toHaveProperty("Close");
  expectTypeOf(AlertDialog).not.toHaveProperty("Description");
  expectTypeOf<AlertDialogContentProps>().not.toHaveProperty("showCloseButton");
  expectTypeOf<AlertDialogContentProps["title"]>().toEqualTypeOf<string>();
  expectTypeOf<AlertDialogContentProps["actionLabel"]>().toEqualTypeOf<string>();
  expectTypeOf<AlertDialogContentProps["variant"]>().toEqualTypeOf<"destructive" | "neutral" | undefined>();
  expectTypeOf<AlertDialogContentProps["size"]>().toEqualTypeOf<
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl"
    | "8xl"
    | "9xl"
    | "10xl"
    | undefined
  >();

  const _tree = (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Delete</AlertDialog.Trigger>
      <AlertDialog.Content
        title="Delete order?"
        actionLabel="Delete"
        cancelLabel="Keep it"
        variant="neutral"
        size="sm"
        isPerformingAction
        isActionDisabled
        isAutomaticallyCloseOnActionEnabled
        onAction={() => undefined}
        onCancel={() => undefined}>
        This permanently removes the order.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );

  const _noClose = (
    // @ts-expect-error showCloseButton is forced false and not overridable
    <AlertDialog.Content showCloseButton title="Delete order?" actionLabel="Delete">
      Body
    </AlertDialog.Content>
  );

  // @ts-expect-error title is required
  const _noTitle = <AlertDialog.Content actionLabel="Delete">Body</AlertDialog.Content>;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <AlertDialog.Trigger as="div" />;
});

test("Root is always modal and never opts back into pointer dismissal", () => {
  // @ts-expect-error an alert dialog cannot be made non-modal
  const _noModal = <AlertDialog.Root modal={false} />;

  // @ts-expect-error a backdrop click can never dismiss an alert dialog
  const _noPointerDismissal = <AlertDialog.Root disablePointerDismissal={false} />;

  const _controlled = <AlertDialog.Root open onOpenChange={(_open: boolean) => undefined} />;
});

test("Trigger takes the same alert-dialog handle as Root, never a plain dialog handle", () => {
  const alertHandle = AlertDialogPrimitive.createHandle();
  const _shared = (
    <>
      <AlertDialog.Root handle={alertHandle} />
      <AlertDialog.Trigger handle={alertHandle}>Delete</AlertDialog.Trigger>
    </>
  );

  const dialogHandle = DialogPrimitive.createHandle();
  // @ts-expect-error no AlertDialog.Root accepts a plain dialog handle, so neither does Trigger
  const _dialogHandle = <AlertDialog.Trigger handle={dialogHandle}>Delete</AlertDialog.Trigger>;
});
