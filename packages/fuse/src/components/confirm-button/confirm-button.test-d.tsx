import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { ConfirmButton as RootConfirmButton } from "@elmeragroup/fuse";
import type { ConfirmButtonProps } from "@elmeragroup/fuse/confirm-button";
import * as ConfirmButtonModule from "@elmeragroup/fuse/confirm-button";
import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

test("ConfirmButton ships from the confirm-button entry and the root barrel", () => {
  expectTypeOf<typeof ConfirmButton>().toEqualTypeOf<typeof RootConfirmButton>();
  expectTypeOf(ConfirmButton).toBeFunction();
});

test("ConfirmButtonProps omits onClick and requires onConfirm", () => {
  expectTypeOf<ConfirmButtonProps>().not.toHaveProperty("onClick");
  expectTypeOf<ConfirmButtonProps["onConfirm"]>().toEqualTypeOf<() => void>();
  expectTypeOf<ConfirmButtonProps["children"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<ConfirmButtonProps["armedChildren"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<ConfirmButtonProps["armedAriaLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf(ConfirmButtonModule).not.toHaveProperty("confirmButtonVariants");
});

test("the element takes Button props except onClick, and onConfirm is required", () => {
  const _ok = (
    <ConfirmButton variant="destructive" onConfirm={() => undefined} armedChildren="Confirm delete">
      Delete
    </ConfirmButton>
  );
  const _icon = (
    <ConfirmButton
      size="icon"
      aria-label="Delete"
      armedAriaLabel="Confirm delete"
      onConfirm={() => undefined}
    />
  );
  const _passthrough = (
    <ConfirmButton variant="success" isPending disabled onConfirm={() => undefined}>
      Approve
    </ConfirmButton>
  );

  // @ts-expect-error onConfirm is required
  const _missing = <ConfirmButton>Delete</ConfirmButton>;
  // @ts-expect-error onClick is owned by ConfirmButton
  const _noOnClick = <ConfirmButton onConfirm={() => undefined} onClick={() => undefined} />;
  // @ts-expect-error icon size requires aria-label
  const _iconMissing = <ConfirmButton size="icon" onConfirm={() => undefined} />; // oxlint-disable-line elmera/require-icon-button-label -- type-level icon-name contract under test
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <ConfirmButton as="div" onConfirm={() => undefined} />;
});
