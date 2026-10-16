import type { ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import {
  fkasExternal,
  guenExternal,
  headingNamed,
  metricPx,
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { Density } from "../../theme/density";
import { AlertDialog } from "../alert-dialog";
import { Dialog } from "../dialog";
import { Sheet } from "../sheet";

let restoreDocumentTheme: () => void;

beforeEach(() => {
  restoreDocumentTheme = snapshotDocumentTheme();
});

afterEach(() => {
  restoreDocumentTheme();
  document.documentElement.removeAttribute("data-density");
});

/** Each modal, opened from a trigger, with its title text and the role its popup takes. */
const MODALS = [
  {
    label: "Dialog.Title",
    role: "dialog",
    title: "Call me back",
    node: (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Call me back</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>
    ),
  },
  {
    label: "AlertDialog's title",
    role: "alertdialog",
    title: "Cancel the order?",
    node: (
      <AlertDialog.Root>
        <AlertDialog.Trigger>Open</AlertDialog.Trigger>
        <AlertDialog.Content title="Cancel the order?" actionLabel="Cancel order">
          The order is not sent.
        </AlertDialog.Content>
      </AlertDialog.Root>
    ),
  },
  {
    label: "Sheet.Title",
    role: "dialog",
    title: "Delivery address",
    node: (
      <Sheet.Root>
        <Sheet.Trigger>Open</Sheet.Trigger>
        <Sheet.Content>
          <Sheet.Header>
            <Sheet.Title>Delivery address</Sheet.Title>
          </Sheet.Header>
        </Sheet.Content>
      </Sheet.Root>
    ),
  },
] as const satisfies readonly {
  label: string;
  role: "dialog" | "alertdialog";
  title: string;
  node: ReactElement;
}[];

async function openTitle({ node, role, title }: (typeof MODALS)[number]): Promise<HTMLElement> {
  render(<LocaleProvider locale="en-US">{node}</LocaleProvider>);
  await userEvent.click(roleNamed("button", "Open"));
  // Base UI mounts the popup a frame or more after the click.
  await expect.element(page.getByRole(role, { name: title })).toBeInTheDocument();
  return headingNamed(title);
}

describe("modal title type", () => {
  // Unit under test: the computed type of each modal's title. Oracle: the issue's contract, Tailwind's
  // `text-xl` (1.25rem on a 1.75rem line) at both densities, above the comfortable control and
  // label text that `DENSITY_METRICS` defines.
  const themes = [
    // fkas sets its headings in Neo Sans; guen's heading font is the sans body font.
    { name: "fkas", theme: fkasExternal },
    { name: "guen", theme: guenExternal },
  ] as const;
  const densities = ["dense", "comfortable"] as const satisfies readonly Density[];

  for (const { name, theme } of themes) {
    for (const density of densities) {
      it.each(MODALS)(`sets $label at 20px on a 28px line in ${name} ${density}`, async (modal) => {
        stampDocumentTheme(theme, "light");
        stampDensity(density);
        const style = getComputedStyle(await openTitle(modal));
        expect(style.fontSize).toBe("20px");
        expect(style.lineHeight).toBe("28px");
      });
    }
  }

  it.each(MODALS)("stands $label above comfortable control and label text", async (modal) => {
    stampDocumentTheme(fkasExternal, "light");
    stampDensity("comfortable");
    const fontSize = px(getComputedStyle(await openTitle(modal)).fontSize);
    expect(fontSize).toBeGreaterThan(metricPx("control-text", "comfortable"));
    expect(fontSize).toBeGreaterThan(metricPx("label-text", "comfortable"));
  });

  it("lets a className put Dialog.Title back on the 16px tight line", async () => {
    stampDocumentTheme(fkasExternal, "light");
    const node = (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title className="text-base leading-none">Call me back</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>
    );
    const style = getComputedStyle(await openTitle({ ...MODALS[0], node }));
    expect(style.fontSize).toBe("16px");
    expect(style.lineHeight).toBe("16px");
  });
});
