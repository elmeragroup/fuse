import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { overlayBackdropOf, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { AlertDialog } from "../alert-dialog";
import { Dialog } from "../dialog";
import { Sheet } from "../sheet";
import type { BackdropBlurProps } from "./overlay-props";

type ScrimCase = {
  readonly label: string;
  readonly role: "dialog" | "alertdialog";
  readonly name: string;
  readonly render: (props: BackdropBlurProps) => ReactElement;
};

/** Each Content part that renders the shared scrim, opened from a trigger. */
const SCRIMS: readonly ScrimCase[] = [
  {
    label: "Dialog.Content",
    role: "dialog",
    name: "Call me back",
    render: (props) => (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content {...props}>
          <Dialog.Title>Call me back</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>
    ),
  },
  {
    label: "AlertDialog.Content",
    role: "alertdialog",
    name: "Cancel the order?",
    render: (props) => (
      <AlertDialog.Root>
        <AlertDialog.Trigger>Open</AlertDialog.Trigger>
        <AlertDialog.Content title="Cancel the order?" actionLabel="Cancel order" {...props}>
          The order is not sent.
        </AlertDialog.Content>
      </AlertDialog.Root>
    ),
  },
  {
    label: "Sheet.Content",
    role: "dialog",
    name: "Delivery address",
    render: (props) => (
      <Sheet.Root>
        <Sheet.Trigger>Open</Sheet.Trigger>
        <Sheet.Content {...props}>
          <Sheet.Title>Delivery address</Sheet.Title>
        </Sheet.Content>
      </Sheet.Root>
    ),
  },
];

/** The scrim's computed paint once its modal has opened. */
async function openScrim({ role, name }: ScrimCase): Promise<CSSStyleDeclaration> {
  await userEvent.click(roleNamed("button", "Open"));
  // Base UI mounts the popup a frame or more after the click.
  await expect.element(page.getByRole(role, { name })).toBeInTheDocument();
  return getComputedStyle(overlayBackdropOf(roleNamed(role, name)));
}

describe("modal scrim", () => {
  // Unit under test: the backdrop each modal Content part renders. Oracle: the scrim's contract,
  // `bg-black/10` with `backdrop-blur-xs`, Tailwind's 4px blur, by default, and the same tint with
  // no backdrop filter when `backdropBlur` is false.
  it.each(SCRIMS)("tints and blurs the page behind $label by default", async (scrim) => {
    renderThemed(withLocale("en-US", scrim.render({})));
    const style = await openScrim(scrim);
    expect(style.backdropFilter).toBe("blur(4px)");
    expect(style.backgroundColor).toBe("oklab(0 0 0 / 0.1)");
  });

  it.each(SCRIMS)("keeps the tint and drops the blur on $label with backdropBlur false", async (scrim) => {
    renderThemed(withLocale("en-US", scrim.render({ backdropBlur: false })));
    const style = await openScrim(scrim);
    expect(style.backdropFilter).toBe("none");
    expect(style.backgroundColor).toBe("oklab(0 0 0 / 0.1)");
  });
});
