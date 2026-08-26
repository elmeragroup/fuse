import { Checkbox } from "@base-ui/react/checkbox";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { disabledHatch } from "../../styles/utils";
import { Field } from "../field/field";
import { SelectionItem } from "./selection-item";

function checkboxNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("checkbox", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected checkbox named ${name}`);
  }
  return element;
}

function titled(name: string): HTMLElement {
  const element = page.getByRole("heading", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected heading named ${name}`);
  }
  return element;
}

function extraNamed(name: string): HTMLElement {
  const element = page.getByRole("region", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected region named ${name}`);
  }
  return element;
}

function shellFrom(name: string): HTMLElement {
  const shell = titled(name).closest("[data-slot=checkbox-item]");
  if (!(shell instanceof HTMLElement)) {
    throw new Error(`expected checkbox-item shell around ${name}`);
  }
  return shell;
}

function controlSlot(shell: HTMLElement): HTMLElement {
  const media = shell.querySelector("[data-slot=item-media]");
  if (!(media instanceof HTMLElement)) {
    throw new Error("expected item-media control slot");
  }
  return media;
}

function subsectionSpacer(label: string): HTMLElement {
  const footer = extraNamed(label).closest("[data-slot=item-footer]");
  let current = footer?.parentElement ?? null;
  while (current) {
    const spacer = [...current.children].find((child) => child.getAttribute("aria-hidden") === "true");
    if (spacer instanceof HTMLElement) {
      return spacer;
    }
    current = current.parentElement;
  }
  throw new Error(`expected aria-hidden subsection spacer beside ${label}`);
}

function tokenBorderColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = `border ${utility}`;
  host.append(probe);
  const color = getComputedStyle(probe).borderTopColor;
  probe.remove();
  return color;
}

function tokenBackgroundColor(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

function tokenBackgroundImage(host: HTMLElement, utility: string): string {
  const probe = document.createElement("span");
  probe.className = utility;
  host.append(probe);
  const image = getComputedStyle(probe).backgroundImage;
  probe.remove();
  return image;
}

function RowTitle({ children }: { children: string }) {
  return (
    <SelectionItem.Title role="heading" aria-level={3}>
      {children}
    </SelectionItem.Title>
  );
}

describe("SelectionItem", () => {
  it("renders data-slot from the dataSlot prop", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );
    expect(shellFrom("Fixed price").getAttribute("data-slot")).toBe("checkbox-item");
    expect(checkboxNamed("Fixed price").getAttribute("aria-checked")).toBe("false");
  });

  it("keeps data-slot on a render host", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />} render={<article />}>
          <RowTitle>Article row</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );
    const article = titled("Article row").closest("article");
    expect(article?.getAttribute("data-slot")).toBe("checkbox-item");
  });

  it("toggles from row text and isolates subsection clicks", async () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <SelectionItem.Content>
            <RowTitle>Fixed price</RowTitle>
          </SelectionItem.Content>
          <SelectionItem.SubSection>
            <button type="button">Details</button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const details = page.getByRole("button", { name: "Details", exact: true }).element();
    expect(details.closest("label")).toBeNull();

    await userEvent.click(titled("Fixed price"));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }));
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps a Fragment-wrapped SubSection inside the label", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <>
            <SelectionItem.SubSection>
              <button type="button">Inside fragment</button>
            </SelectionItem.SubSection>
          </>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const button = page.getByRole("button", { name: "Inside fragment", exact: true }).element();
    expect(button.closest("label")).not.toBeNull();
    const footer = button.closest("[data-slot=item-footer]");
    if (!(footer instanceof HTMLElement)) {
      throw new Error("expected the wrapped SubSection to render an item-footer");
    }
    footer.click();
    const box = page.getByRole("checkbox", { checked: true }).element();
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("renders nothing for a childless SubSection", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection />
        </SelectionItem.Shell>
      </Field.Root>
    );
    expect(shellFrom("Fixed price").querySelector("[data-slot=item-footer]")).toBeNull();
    expect(page.getByRole("region", { name: "Hidden extra", exact: true }).query()).toBeNull();
  });

  it("makes hidden SubSection content unclickable", async () => {
    let extraClicks = 0;
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>Fixed price</RowTitle>
          <SelectionItem.SubSection mode="hidden">
            <button
              type="button"
              onClick={() => {
                extraClicks += 1;
              }}>
              Hidden details
            </button>
          </SelectionItem.SubSection>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const details = page.getByRole("button", { name: "Hidden details", exact: true });
    const detailsEl = details.element();
    if (!(detailsEl instanceof HTMLElement)) {
      throw new Error("expected hidden details button");
    }
    const footer = detailsEl.closest("[data-slot=item-footer]");
    expect(footer).toBeInstanceOf(HTMLElement);
    if (!(footer instanceof HTMLElement)) {
      throw new Error("expected item-footer");
    }
    expect(footer.getAttribute("data-mode")).toBe("hidden");
    expect(getComputedStyle(footer).pointerEvents).toBe("none");

    const box = detailsEl.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + Math.max(box.width, 1) / 2,
      box.top + Math.max(box.height, 1) / 2
    );
    expect(hit instanceof Node && detailsEl.contains(hit)).toBe(false);
    if (hit instanceof HTMLElement) {
      await userEvent.click(hit);
    }
    expect(extraClicks).toBe(0);
  });

  it("places the control after the row at end and matches spacer width in both positions", () => {
    renderThemed(
      <div>
        <Field.Root className="contents">
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Start row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="Start extra">
              Start extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
        <Field.Root className="contents">
          <SelectionItem.Shell dataSlot="checkbox-item" controlPosition="end" control={<Checkbox.Root />}>
            <RowTitle>End row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="End extra">
              End extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
        <Field.Root className="contents">
          <SelectionItem.Shell
            dataSlot="checkbox-item"
            controlPosition="end"
            control={<span role="img" aria-label="Wide indicator" className="block h-4 w-12" />}>
            <RowTitle>Wide row</RowTitle>
            <SelectionItem.SubSection role="region" aria-label="Wide extra">
              Wide extra
            </SelectionItem.SubSection>
          </SelectionItem.Shell>
        </Field.Root>
      </div>
    );

    const start = shellFrom("Start row");
    const end = shellFrom("End row");
    const wide = shellFrom("Wide row");
    const startControl = checkboxNamed("Start row").getBoundingClientRect();
    const startTitle = titled("Start row").getBoundingClientRect();
    expect(startControl.left).toBeLessThan(startTitle.left);

    const endControl = checkboxNamed("End row").getBoundingClientRect();
    const endTitle = titled("End row").getBoundingClientRect();
    expect(endControl.left).toBeGreaterThan(endTitle.left);

    expect(getComputedStyle(start).display).toBe("grid");
    expect(getComputedStyle(end).display).toBe("grid");
    expect(getComputedStyle(wide).display).toBe("grid");

    const startSpacer = subsectionSpacer("Start extra");
    const endSpacer = subsectionSpacer("End extra");
    const wideSpacer = subsectionSpacer("Wide extra");
    expect(startSpacer.getAttribute("style")).toBeNull();
    expect(endSpacer.getAttribute("style")).toBeNull();
    expect(wideSpacer.getAttribute("style")).toBeNull();
    expect(startSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(start).getBoundingClientRect().left,
      0
    );
    expect(endSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(end).getBoundingClientRect().left,
      0
    );
    expect(wideSpacer.getBoundingClientRect().left).toBeCloseTo(
      controlSlot(wide).getBoundingClientRect().left,
      0
    );
    expect(startSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(start).getBoundingClientRect().width,
      0
    );
    expect(endSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(end).getBoundingClientRect().width,
      0
    );
    expect(wideSpacer.getBoundingClientRect().width).toBeCloseTo(
      controlSlot(wide).getBoundingClientRect().width,
      0
    );
    expect(wideSpacer.getBoundingClientRect().width).toBeGreaterThan(
      startSpacer.getBoundingClientRect().width
    );

    const endExtra = extraNamed("End extra").getBoundingClientRect();
    expect(endSpacer.getBoundingClientRect().left).toBeGreaterThan(endExtra.left);
    const startExtra = extraNamed("Start extra").getBoundingClientRect();
    expect(startSpacer.getBoundingClientRect().left).toBeLessThan(startExtra.left);
  });

  it("does not toggle a disabled control on row click and hatches the surface", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<Checkbox.Root disabled />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price");
    expect(box.getAttribute("aria-checked")).toBe("false");
    const shell = shellFrom("Fixed price");
    const shellStyle = getComputedStyle(shell);
    expect(shellStyle.cursor).toBe("not-allowed");
    expect(shellStyle.backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
    expect(shellStyle.backgroundImage).toBe(tokenBackgroundImage(shell, disabledHatch));
    expect(shellStyle.backgroundImage).not.toBe("none");

    titled("Fixed price").click();
    expect(checkboxNamed("Fixed price", false).getAttribute("aria-checked")).toBe("false");
  });

  it("reflects the checked descendant on the shell surface", () => {
    renderThemed(
      <Field.Root>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root defaultChecked />}>
          <RowTitle>Fixed price</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const box = checkboxNamed("Fixed price", true);
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(box.hasAttribute("data-checked")).toBe(true);
    const shell = shellFrom("Fixed price");
    expect(getComputedStyle(shell).borderTopColor).toBe(tokenBorderColor(shell, "border-primary"));
    expect(getComputedStyle(shell).backgroundColor).toBe(tokenBackgroundColor(shell, "bg-muted"));
  });

  it("collapses stacked borders and pulls a checked non-first shell up one pixel", () => {
    renderThemed(
      <Field.Root className="gap-0">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
          <RowTitle>First</RowTitle>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root defaultChecked />}>
          <RowTitle>Second</RowTitle>
        </SelectionItem.Shell>
      </Field.Root>
    );

    const first = shellFrom("First");
    const second = shellFrom("Second");
    expect(getComputedStyle(second).marginTop).toBe("-1px");
    expect(getComputedStyle(second).borderTopColor).toBe(tokenBorderColor(second, "border-primary"));
    expect(getComputedStyle(first).marginTop).not.toBe("-1px");
  });

  it("toggles from the keyboard on the plugged-in control", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Field.Root>
          <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox.Root />}>
            <RowTitle>Fixed price</RowTitle>
          </SelectionItem.Shell>
        </Field.Root>
      </>
    );

    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(checkboxNamed("Fixed price"));
    await userEvent.keyboard(" ");
    expect(checkboxNamed("Fixed price", true).getAttribute("aria-checked")).toBe("true");
  });
});
