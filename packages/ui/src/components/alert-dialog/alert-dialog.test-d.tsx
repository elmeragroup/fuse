import { expectTypeOf, test } from "vitest";

import type { AlertDialog as RootAlertDialog } from "@elmeragroup/ui";
import type { AlertDialogContentProps } from "@elmeragroup/ui/alert-dialog";
import { AlertDialog } from "@elmeragroup/ui/alert-dialog";

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
