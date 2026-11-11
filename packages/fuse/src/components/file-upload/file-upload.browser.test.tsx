import { useState } from "react";
import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { expectInvalidRing, ringLayers, settleTransitions } from "../../../test/assert-invalid-ring";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { isHTMLElement } from "../../internal/dom-node";
import { Button } from "../button/button";
import { Field } from "../field/index";
import { SkeletonReveal } from "../skeleton/skeleton-reveal";
import { useFileUpload } from "./file-upload-context";
import { FileUpload } from "./index";
import type { FileRejection } from "./split-files";

/** The Root's hidden picker input. It has no role or name to query it by. */
function fileInput(host: HTMLElement): HTMLInputElement {
  // The picker input is `hidden`, so it is outside the accessibility tree. It never has a
  // `name`; the separate input a form posts does.
  const input = host.querySelector('input[type="file"]:not([name])');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("expected the Root's hidden file input");
  }
  return input;
}

/** Stubs the hidden input's `click`, which would open the picker, and returns the spy. */
function stubPicker(host: HTMLElement) {
  return vi.spyOn(fileInput(host), "click").mockReturnValue(undefined);
}

function fileTransfer(files: readonly File[]): DataTransfer {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  return transfer;
}

/** Picks `files` the way the browser does: it sets `input.files`, then fires `change`. */
function pick(input: HTMLInputElement, files: readonly File[]): void {
  input.files = fileTransfer(files).files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Dispatches a paste carrying `files` at `target`, and returns the event to read its outcome. Root
 * cancels a paste it takes before it reads the files, so an uncancelled paste delivers nothing.
 */
function paste(target: EventTarget, files: readonly File[]): ClipboardEvent {
  // A browser's paste is composed, so it leaves a shadow root on its way to the document.
  const event = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData: fileTransfer(files),
  });
  target.dispatchEvent(event);
  return event;
}

const png = (name: string) => new File(["png"], name, { type: "image/png" });
const txt = (name: string) => new File(["txt"], name, { type: "text/plain" });
const pdf = (name: string) => new File(["pdf"], name, { type: "" });

/** A rejection as `[reason, name]`. */
function described(rejection: FileRejection): readonly [string, string] {
  return "file" in rejection ? [rejection.reason, rejection.file.name] : [rejection.reason, rejection.name];
}

describe("FileUpload.Root and FileUpload.Trigger", () => {
  it("opens the picker once per Trigger click, from a type=button that survives type={undefined}", async () => {
    const { host } = renderThemed(
      <FileUpload.Root>
        <FileUpload.Trigger type={undefined}>Add files</FileUpload.Trigger>
      </FileUpload.Root>
    );
    const click = stubPicker(host);
    await userEvent.click(roleNamed("button", "Add files"));
    expect(click).toHaveBeenCalledTimes(1);
    expect(roleNamed("button", "Add files").getAttribute("type")).toBe("button");
  });

  it.each([
    ["a native button", <button key="native" />],
    ["a Fuse Button", <Button key="fuse" size="sm" />],
  ])("opens the picker without submitting the form when it renders %s", async (_name, render) => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const { host } = renderThemed(
      <form aria-label="Upload form">
        <FileUpload.Root>
          <FileUpload.Trigger render={render}>Add files</FileUpload.Trigger>
        </FileUpload.Root>
      </form>
    );
    formNamed("Upload form").addEventListener("submit", onSubmit);
    const click = stubPicker(host);
    await userEvent.click(roleNamed("button", "Add files"));
    expect(click).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("writes accept, multiple, capture and webkitdirectory on the hidden input, and no name", () => {
    const { host } = renderThemed(
      <FileUpload.Root accept="image/*,.pdf" multiple directory capture="environment">
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
      </FileUpload.Root>
    );
    const input = fileInput(host);
    expect(input.hidden).toBe(true);
    expect(input.tabIndex).toBe(-1);
    expect(input.accept).toBe("image/*,.pdf");
    expect(input.multiple).toBe(true);
    expect(input.getAttribute("capture")).toBe("environment");
    expect(input.webkitdirectory).toBe(true);
    expect(input.hasAttribute("name")).toBe(false);
  });

  it("splits a pick into onSelect and onReject by accept", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    const { host } = renderThemed(
      <FileUpload.Root accept="image/*, .pdf" multiple onSelect={onSelect} onReject={onReject}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
      </FileUpload.Root>
    );
    pick(fileInput(host), [png("a.png"), txt("notes.txt"), pdf("b.pdf")]);
    expect(onSelect.mock.calls.map(([files]) => files.map((file) => file.name))).toEqual([
      ["a.png", "b.pdf"],
    ]);
    expect(onReject.mock.calls.map(([rejections]) => rejections.map(described))).toEqual([
      [["type", "notes.txt"]],
    ]);
  });

  it("resets the input after a pick, so picking the same file again selects it again", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host } = renderThemed(
      <FileUpload.Root onSelect={onSelect}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
      </FileUpload.Root>
    );
    const input = fileInput(host);
    const file = png("a.png");
    pick(input, [file]);
    expect(input.value).toBe("");
    pick(input, [file]);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect.mock.calls[1]?.[0][0]).toBe(file);
  });

  it("disables the Trigger, opens nothing and ignores a paste while Root is disabled", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host } = renderThemed(
      <FileUpload.Root disabled onSelect={onSelect}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <button type="button">Inside</button>
      </FileUpload.Root>
    );
    const click = stubPicker(host);
    await expect.element(page.getByRole("button", { name: "Add files", exact: true })).toBeDisabled();
    await userEvent.click(roleNamed("button", "Add files"), { force: true });
    expect(click).not.toHaveBeenCalled();

    roleNamed("button", "Inside").focus();
    const event = paste(document.body, [png("a.png")]);
    expect(event.defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disables a Trigger through its own disabled while Root stays enabled", async () => {
    renderThemed(
      <FileUpload.Root>
        <FileUpload.Trigger disabled>Add files</FileUpload.Trigger>
        <FileUpload.Trigger>Add more</FileUpload.Trigger>
      </FileUpload.Root>
    );
    await expect.element(page.getByRole("button", { name: "Add files", exact: true })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Add more", exact: true })).toBeEnabled();
  });
});

describe("FileUpload.Description", () => {
  it("describes the Trigger, after the consumer's own aria-describedby", async () => {
    renderThemed(
      <FileUpload.Root>
        <p id="own-hint">Images only.</p>
        <FileUpload.Trigger aria-describedby="own-hint">Add files</FileUpload.Trigger>
        <FileUpload.Description>Up to 3 files.</FileUpload.Description>
      </FileUpload.Root>
    );
    await expect
      .element(page.getByRole("button", { name: "Add files", exact: true }))
      .toHaveAccessibleDescription("Images only. Up to 3 files.");
  });

  it("describes the Trigger with the id a render element gives the Description", async () => {
    renderThemed(
      <FileUpload.Root>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <FileUpload.Description render={<p id="upload-hint" />}>Up to 3 files.</FileUpload.Description>
      </FileUpload.Root>
    );
    const trigger = page.getByRole("button", { name: "Add files", exact: true });
    await expect.element(trigger).toHaveAccessibleDescription("Up to 3 files.");
    expect(trigger.element().getAttribute("aria-describedby")).toBe("upload-hint");
  });

  it("follows state in a Description whose parent reads useFileUpload and passes an inline render", async () => {
    function Hint(): ReactElement {
      const { state } = useFileUpload();
      return (
        <FileUpload.Description render={<p />}>
          {state.dragging ? "Release files" : "Drop files"}
        </FileUpload.Description>
      );
    }
    const { host } = renderThemed(
      <FileUpload.Root>
        <FileUpload.Dropzone>
          <FileUpload.Trigger>Add files</FileUpload.Trigger>
          <Hint />
        </FileUpload.Dropzone>
      </FileUpload.Root>
    );
    const trigger = page.getByRole("button", { name: "Add files", exact: true });
    await expect.element(trigger).toHaveAccessibleDescription("Drop files");
    drag(parts(host).zone, "dragenter", fileTransfer([png("a.png")]));
    await expect.element(trigger).toHaveAccessibleDescription("Release files");
  });

  it("keeps an id listed until the last Description with that id unmounts", async () => {
    const tree = (both: boolean) => (
      <FileUpload.Root>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <FileUpload.Description id="limits">Up to 3 files.</FileUpload.Description>
        {both ? <FileUpload.Description id="limits">Up to 3 files.</FileUpload.Description> : null}
      </FileUpload.Root>
    );
    const { rerender } = renderThemed(tree(true));
    const trigger = page.getByRole("button", { name: "Add files", exact: true });
    await expect.poll(() => trigger.element().getAttribute("aria-describedby")).toBe("limits");
    rerender(tree(false));
    await nextFrames(2);
    expect(trigger.element().getAttribute("aria-describedby")).toBe("limits");
    await expect.element(trigger).toHaveAccessibleDescription("Up to 3 files.");
  });
});

describe("paste", () => {
  it("selects a pasted file while the Trigger has focus, from a paste that targets the body", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    renderThemed(
      <FileUpload.Root onSelect={onSelect}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
      </FileUpload.Root>
    );
    roleNamed("button", "Add files").focus();
    const event = paste(document.body, [png("screenshot.png")]);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(onSelect.mock.calls.map(([files]) => files.map((file) => file.name))).toEqual([
        ["screenshot.png"],
      ]);
    });
  });

  it("keeps taking pastes after a new render element replaces the Root's DOM node", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const tree = (render: ReactElement) => (
      <FileUpload.Root render={render} onSelect={onSelect}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
      </FileUpload.Root>
    );
    const { rerender } = renderThemed(tree(<div />));
    rerender(tree(<section />));
    roleNamed("button", "Add files").focus();
    expect(paste(document.body, [png("a.png")]).defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
  });

  it("gives a paste to the nearest Root only, when Roots nest", async () => {
    const outer = vi.fn<(files: File[]) => void>();
    const inner = vi.fn<(files: File[]) => void>();
    renderThemed(
      <FileUpload.Root onSelect={outer}>
        <FileUpload.Trigger>Add to the folder</FileUpload.Trigger>
        <FileUpload.Root onSelect={inner}>
          <FileUpload.Trigger>Add to the item</FileUpload.Trigger>
        </FileUpload.Root>
      </FileUpload.Root>
    );
    roleNamed("button", "Add to the item").focus();
    paste(document.body, [png("a.png")]);
    await vi.waitFor(() => expect(inner).toHaveBeenCalledTimes(1));
    expect(outer).not.toHaveBeenCalled();

    roleNamed("button", "Add to the folder").focus();
    paste(document.body, [png("b.png")]);
    await vi.waitFor(() => expect(outer).toHaveBeenCalledTimes(1));
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("selects a pasted file while a range input inside Root has focus, as a Slider thumb's does", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    renderThemed(
      <FileUpload.Root onSelect={onSelect}>
        <input type="range" aria-label="Quality" />
      </FileUpload.Root>
    );
    roleNamed("slider", "Quality").focus();
    expect(paste(document.body, [png("a.png")]).defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(onSelect.mock.calls.map(([files]) => files.map((file) => file.name))).toEqual([["a.png"]]);
    });
  });

  it("leaves a paste alone with focus outside Root, or in a text input inside Root", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    renderThemed(
      <>
        <button type="button">Outside</button>
        <FileUpload.Root onSelect={onSelect}>
          <FileUpload.Trigger>Add files</FileUpload.Trigger>
          <input aria-label="Caption" />
        </FileUpload.Root>
      </>
    );
    roleNamed("button", "Outside").focus();
    const outside = paste(document.body, [png("a.png")]);
    roleNamed("textbox", "Caption").focus();
    const inField = paste(roleNamed("textbox", "Caption"), [png("b.png")]);
    expect(outside.defaultPrevented).toBe(false);
    expect(inField.defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("useFileUpload", () => {
  const sample = png("sample.png");

  function AddSample(): ReactElement {
    const { state, actions } = useFileUpload();
    return (
      <button type="button" onClick={() => actions.add([sample])}>
        {state.disabled ? "Add sample (off)" : "Add sample"}
      </button>
    );
  }

  it("reads the Root's state and adds files through the same split as a pick", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    renderThemed(
      <FileUpload.Root accept="text/plain" onSelect={onSelect} onReject={onReject}>
        <AddSample />
      </FileUpload.Root>
    );
    await userEvent.click(roleNamed("button", "Add sample"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject.mock.calls.map(([rejections]) => rejections.map(described))).toEqual([
      [["type", "sample.png"]],
    ]);
  });

  it("reports a disabled Root, whose add does nothing", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    renderThemed(
      <FileUpload.Root disabled onSelect={onSelect}>
        <AddSample />
      </FileUpload.Root>
    );
    await userEvent.click(roleNamed("button", "Add sample (off)"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("throws outside a Root, naming FileUpload.Root", () => {
    renderThemed(
      <CaughtError>
        <AddSample />
      </CaughtError>
    );
    expect(caughtError().message).toBe("useFileUpload must be used within FileUpload.Root.");
  });
});

/** The Root and Dropzone elements. Neither has a role, and their state lives in data attributes. */
type Parts = { readonly root: HTMLElement; readonly zone: HTMLElement };

function parts(host: HTMLElement): Parts {
  // The Root and Dropzone are plain divs, and data-drop-target is their public state.
  const root = host.querySelector('[data-slot="file-upload"]');
  const zone = host.querySelector('[data-slot="file-upload-dropzone"]');
  if (!isHTMLElement(root) || !isHTMLElement(zone)) {
    throw new Error("expected a FileUpload.Root holding a FileUpload.Dropzone");
  }
  return { root, zone };
}

/** Dispatches a drag event as the browser does during a drag, and returns it to read its outcome. */
function drag(
  target: Element,
  type: "dragenter" | "dragover" | "dragleave" | "drop",
  dataTransfer: DataTransfer
): DragEvent {
  const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
  target.dispatchEvent(event);
  return event;
}

function Zone(props: {
  readonly onSelect?: (files: File[]) => void;
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly onReject?: (rejections: FileRejection[]) => void;
}): ReactElement {
  return (
    <FileUpload.Root {...props}>
      <FileUpload.Dropzone>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <button type="button">Clear list</button>
      </FileUpload.Dropzone>
    </FileUpload.Root>
  );
}

describe("FileUpload.Dropzone", () => {
  it("opens the picker from a click on its empty surface, never from an unrelated control inside it", async () => {
    const { host } = renderThemed(<Zone />);
    // The native picker cannot be observed; its one opener is the hidden input's click().
    const click = stubPicker(host);

    parts(host).zone.click();
    expect(click).toHaveBeenCalledTimes(1);
    await userEvent.click(roleNamed("button", "Clear list"));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("keeps the highlight while a drag moves onto a child, and clears it when the drag leaves the zone", async () => {
    const { host } = renderThemed(<Zone multiple />);
    const { root, zone } = parts(host);
    const trigger = roleNamed("button", "Add files");
    const transfer = fileTransfer([png("a.png")]);

    drag(zone, "dragenter", transfer);
    await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(true);
    expect(root.hasAttribute("data-dragging")).toBe(true);

    // WebKit fires dragleave with no relatedTarget, in either order relative to the child's dragenter.
    drag(trigger, "dragenter", transfer);
    drag(zone, "dragleave", transfer);
    drag(trigger, "dragleave", transfer);
    drag(trigger, "dragenter", transfer);
    drag(trigger, "dragleave", transfer);
    await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(false);

    drag(zone, "dragenter", transfer);
    drag(trigger, "dragenter", transfer);
    drag(trigger, "dragleave", transfer);
    await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(true);
    drag(zone, "dragleave", transfer);
    await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(false);
    expect(root.hasAttribute("data-dragging")).toBe(false);
  });

  it("splits a drop into onSelect and onReject by accept, handing back the dropped Files", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    const { host } = renderThemed(
      <Zone accept="image/png,.pdf" multiple onSelect={onSelect} onReject={onReject} />
    );
    const { zone } = parts(host);
    const a = png("a.png");
    const b = new File(["pdf"], "b.PDF", { type: "application/pdf" });
    const c = new File(["exe"], "c.exe", { type: "application/x-msdownload" });
    const transfer = fileTransfer([a, b, c]);

    drag(zone, "dragenter", transfer);
    const drop = drag(zone, "drop", transfer);
    expect(drop.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    const [selected] = onSelect.mock.calls[0] ?? [];
    expect(selected?.length).toBe(2);
    expect(selected?.[0]).toBe(a);
    expect(selected?.[1]).toBe(b);
    const [rejected] = onReject.mock.calls[0] ?? [];
    expect(rejected?.map((rejection) => rejection.reason)).toEqual(["type"]);
    expect(rejected?.[0] !== undefined && "file" in rejected[0] && rejected[0].file).toBe(c);
    await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(false);
  });

  it("ignores drags on a disabled Root, whose drop the document still keeps from opening the file", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host } = renderThemed(<Zone disabled onSelect={onSelect} />);
    const { zone } = parts(host);
    expect(zone.hasAttribute("data-disabled")).toBe(true);
    const transfer = fileTransfer([png("a.png")]);

    drag(zone, "dragenter", transfer);
    const drop = drag(zone, "drop", transfer);
    expect(drop.defaultPrevented).toBe(true);
    await expect.poll(() => onSelect.mock.calls.length).toBe(0);
    expect(zone.hasAttribute("data-drop-target")).toBe(false);
  });
});

/** A FileUpload in a Field, with its own description and one of the Field's after its control. */
function FieldUpload(props: { readonly invalid?: boolean }): ReactElement {
  return (
    <Field.Root invalid={props.invalid ?? false}>
      <Field.Label>Attachments</Field.Label>
      <p id="own-hint">PDF only.</p>
      <FileUpload.Root>
        <FileUpload.Dropzone>
          <FileUpload.Trigger aria-describedby="own-hint">Browse files</FileUpload.Trigger>
          <FileUpload.Description>Up to 3 files.</FileUpload.Description>
        </FileUpload.Dropzone>
      </FileUpload.Root>
      <Field.Error match>Add at least one file.</Field.Error>
      <Field.Description>Shared with your manager.</Field.Description>
    </Field.Root>
  );
}

describe("FileUpload in a Field", () => {
  it("names the Trigger by its own text, then Field.Label, and opens the picker from a click on the label", async () => {
    const { host } = renderThemed(<FieldUpload />);
    const trigger = page.getByRole("button", { name: "Browse files Attachments", exact: true });
    await expect.element(trigger).toBeInTheDocument();
    const click = stubPicker(host);
    await userEvent.click(page.getByText("Attachments", { exact: true }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("follows the Trigger's own id, and reports a second Trigger in the Field in development", async () => {
    const error = vi.spyOn(console, "error").mockReturnValue(undefined);
    const tree = (second: boolean) => (
      <Field.Root>
        <Field.Label>Attachments</Field.Label>
        <FileUpload.Root>
          <FileUpload.Trigger id="photo-trigger">Browse files</FileUpload.Trigger>
          {second ? <FileUpload.Trigger>Take photo</FileUpload.Trigger> : null}
        </FileUpload.Root>
      </Field.Root>
    );
    const { rerender } = renderThemed(tree(false));
    const trigger = page.getByRole("button", { name: "Browse files Attachments", exact: true });
    await expect.element(trigger).toHaveAttribute("id", "photo-trigger");
    const label = page.getByText("Attachments", { exact: true }).element();
    expect(label instanceof HTMLLabelElement && label.control).toBe(trigger.element());
    expect(error).not.toHaveBeenCalled();

    rerender(tree(true));
    await expect.poll(() => error.mock.calls.length).toBe(1);
    expect(error.mock.calls[0]?.[0]).toBe(
      "FileUpload: render one FileUpload.Trigger inside a Field. The Field's label, description and error belong to one control."
    );
  });

  it("keeps the Trigger's own aria-invalid over the Field's state, inside a Field and outside one", async () => {
    renderThemed(
      <>
        <FileUpload.Root>
          <FileUpload.Trigger aria-invalid>Outside</FileUpload.Trigger>
        </FileUpload.Root>
        <Field.Root invalid>
          <Field.Label>Attachments</Field.Label>
          <FileUpload.Root>
            <FileUpload.Trigger aria-invalid={false}>Inside</FileUpload.Trigger>
          </FileUpload.Root>
        </Field.Root>
      </>
    );
    await expect
      .element(page.getByRole("button", { name: "Outside", exact: true }))
      .toHaveAttribute("aria-invalid", "true");
    await expect
      .element(page.getByRole("button", { name: "Inside Attachments", exact: true }))
      .toHaveAttribute("aria-invalid", "false");
  });

  it("describes the Trigger by its own ids, then the Field's description and error, then FileUpload.Description", async () => {
    renderThemed(<FieldUpload invalid />);
    await expect
      .element(page.getByRole("button", { name: "Browse files Attachments", exact: true }))
      .toHaveAccessibleDescription(
        "PDF only. Add at least one file. Shared with your manager. Up to 3 files."
      );
  });

  it.each([
    ["a Button Trigger in a Dropzone", "button", "dropzone"],
    ["a plain Trigger in a Dropzone", "plain", "dropzone"],
    ["a Button Trigger without a Dropzone", "button", "bare"],
  ] as const)(
    "paints one invalid face, on the Trigger, for %s in an invalid Field",
    async (_name, look, layout) => {
      const tree = (invalid: boolean) => {
        const trigger = (
          <FileUpload.Trigger render={look === "button" ? <Button variant="outline" size="sm" /> : undefined}>
            Browse files
          </FileUpload.Trigger>
        );
        return (
          <Field.Root invalid={invalid}>
            <Field.Label>Attachments</Field.Label>
            <FileUpload.Root>
              {layout === "dropzone" ? <FileUpload.Dropzone>{trigger}</FileUpload.Dropzone> : trigger}
            </FileUpload.Root>
          </Field.Root>
        );
      };
      const { host, rerender } = renderThemed(tree(false));
      const triggerLocator = page.getByRole("button", { name: "Browse files Attachments", exact: true });
      await expect.element(triggerLocator).not.toHaveAttribute("aria-invalid");
      const trigger = roleNamed("button", "Browse files Attachments");
      const zone = host.querySelector('[data-slot="file-upload-dropzone"]');
      // The oracle: the same parts rendered in a valid Field, so the Dropzone's resting face is
      // whatever its recipe paints, never a colour written here.
      const face = (element: Element | null) => {
        if (!isHTMLElement(element)) {
          return null;
        }
        settleTransitions(element);
        return { border: getComputedStyle(element).borderTopColor, rings: ringLayers(element) };
      };
      const validZone = face(zone);

      rerender(tree(true));
      await expect.element(triggerLocator).toHaveAttribute("aria-invalid", "true");
      expectInvalidRing("Trigger", trigger);
      expect(face(zone), "Dropzone face").toEqual(validZone);
    }
  );

  it.each([
    [
      "Field.Root disabled",
      (children: ReactElement) => (
        <Field.Root disabled>
          <Field.Label>Attachments</Field.Label>
          {children}
        </Field.Root>
      ),
    ],
    ["a disabled Field.Set", (children: ReactElement) => <Field.Set disabled>{children}</Field.Set>],
  ])("disables the FileUpload inside %s", async (_name, wrap) => {
    const onSelect = vi.fn<(files: File[]) => void>();
    function State(): ReactElement {
      return <output>{useFileUpload().state.disabled ? "disabled" : "enabled"}</output>;
    }
    const { host } = renderThemed(
      wrap(
        <FileUpload.Root onSelect={onSelect}>
          <FileUpload.Dropzone>
            <FileUpload.Trigger>Browse files</FileUpload.Trigger>
            <button type="button">Inside</button>
          </FileUpload.Dropzone>
          <State />
        </FileUpload.Root>
      )
    );
    const click = stubPicker(host);
    const trigger = page.getByRole("button", { name: /^Browse files/u });
    await expect.element(trigger).toBeDisabled();
    await userEvent.click(trigger, { force: true });
    parts(host).zone.click();
    expect(click).not.toHaveBeenCalled();
    expect(parts(host).zone.hasAttribute("data-disabled")).toBe(true);
    await expect.element(page.getByRole("status")).toHaveTextContent("disabled");

    roleNamed("button", "Inside").focus();
    expect(paste(document.body, [png("a.png")]).defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("leaves a Trigger outside any Field unlabelled by a Field, valid and without an id", () => {
    renderThemed(
      <>
        <Field.Root invalid>
          <Field.Label>Other field</Field.Label>
          <input aria-label="Other input" />
        </Field.Root>
        <Zone />
      </>
    );
    const trigger = roleNamed("button", "Add files");
    expect(trigger.hasAttribute("id")).toBe(false);
    expect(trigger.hasAttribute("aria-labelledby")).toBe(false);
    expect(trigger.hasAttribute("aria-invalid")).toBe(false);
  });

  it("writes no id and reports no second Trigger for two Triggers in a SkeletonReveal outside any Field", async () => {
    const error = vi.spyOn(console, "error").mockReturnValue(undefined);
    try {
      renderThemed(
        <SkeletonReveal loading={false}>
          <FileUpload.Root>
            <FileUpload.Trigger>Browse files</FileUpload.Trigger>
            <FileUpload.Trigger>Take photo</FileUpload.Trigger>
          </FileUpload.Root>
        </SkeletonReveal>
      );
      for (const name of ["Browse files", "Take photo"]) {
        const trigger = page.getByRole("button", { name, exact: true });
        await expect.element(trigger).toBeInTheDocument();
        expect(trigger.element().hasAttribute("id"), name).toBe(false);
      }
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

/** What `data` carries under `name`, each file as `[name, size]`. */
function entries(data: FormData, name: string): ReadonlyArray<readonly [string, number] | string> {
  return data
    .getAll(name)
    .map((entry) => (entry instanceof File ? ([entry.name, entry.size] as const) : entry));
}

/** What `new FormData(form)` carries under `name`, each file as `[name, size]`. */
function posted(form: string, name: string): ReadonlyArray<readonly [string, number] | string> {
  return entries(new FormData(formNamed(form)), name);
}

/** A form whose FileUpload adds each pick to the files it posts, with a Remove button per file. */
function PostedUpload(props: {
  readonly initial?: readonly File[];
  readonly onSelect?: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<readonly File[]>(props.initial ?? []);
  return (
    <form aria-label="Upload form">
      <FileUpload.Root
        name="attachments"
        files={files}
        accept="image/*,.pdf"
        multiple
        onSelect={(picked) => {
          props.onSelect?.(picked);
          setFiles((current) => [...current, ...picked]);
        }}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
      </FileUpload.Root>
      {files.map((file) => (
        <button
          key={file.name}
          type="button"
          onClick={() => setFiles((current) => current.filter((kept) => kept !== file))}>
          Remove {file.name}
        </button>
      ))}
    </form>
  );
}

describe("posting with a native form", () => {
  it("posts the controlled files under name, and a second pick adds to the post rather than wiping it", async () => {
    const { host } = renderThemed(<PostedUpload />);
    const input = fileInput(host);
    pick(input, [png("a.png")]);
    await expect.poll(() => posted("Upload form", "attachments")).toEqual([["a.png", 3]]);

    pick(input, [pdf("b.pdf")]);
    await expect
      .poll(() => posted("Upload form", "attachments"))
      .toEqual([
        ["a.png", 3],
        ["b.pdf", 3],
      ]);
  });

  it("follows the parent's files, so removing a file removes it from the post", async () => {
    renderThemed(<PostedUpload initial={[png("a.png"), pdf("b.pdf")]} />);
    await expect
      .poll(() => posted("Upload form", "attachments"))
      .toEqual([
        ["a.png", 3],
        ["b.pdf", 3],
      ]);

    await userEvent.click(roleNamed("button", "Remove a.png"));
    await expect.poll(() => posted("Upload form", "attachments")).toEqual([["b.pdf", 3]]);
  });

  it("keeps the posted files when a pick is rejected and the parent's files stay as they are", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host } = renderThemed(<PostedUpload initial={[png("a.png")]} onSelect={onSelect} />);
    await expect.poll(() => posted("Upload form", "attachments")).toEqual([["a.png", 3]]);

    pick(fileInput(host), [txt("notes.txt")]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(posted("Upload form", "attachments")).toEqual([["a.png", 3]]);
  });

  it("posts the controlled files again after a native form reset, without calling onSelect", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    renderThemed(<PostedUpload initial={[png("a.png")]} onSelect={onSelect} />);
    await expect.poll(() => posted("Upload form", "attachments")).toEqual([["a.png", 3]]);

    formNamed("Upload form").reset();
    await vi.waitFor(() => {
      expect(posted("Upload form", "attachments")).toEqual([["a.png", 3]]);
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("sends the controlled files to a form action, and posts them again after the action resets the form", async () => {
    const send = vi.fn<(data: FormData) => Promise<void>>(() => Promise.resolve());
    function Order(): ReactElement {
      const [files] = useState<readonly File[]>([png("a.png")]);
      return (
        <form aria-label="Upload form" action={send}>
          <FileUpload.Root name="attachments" files={files}>
            <FileUpload.Trigger>Add files</FileUpload.Trigger>
          </FileUpload.Root>
          <input name="note" aria-label="Note" />
          <button type="submit">Send</button>
        </form>
      );
    }
    renderThemed(<Order />);
    const note = page.getByRole("textbox", { name: "Note", exact: true });
    await userEvent.fill(note, "Receipts");
    await userEvent.click(roleNamed("button", "Send"));
    await expect.poll(() => send.mock.calls.length).toBe(1);
    const sent = send.mock.calls[0]?.[0];
    expect(sent === undefined ? undefined : entries(sent, "attachments")).toEqual([["a.png", 3]]);

    // React resets the form after the action: the native note empties, the files stay posted.
    await expect.element(note).toHaveValue("");
    await vi.waitFor(() => {
      expect(posted("Upload form", "attachments")).toEqual([["a.png", 3]]);
    });
  });

  it("posts the files once name and files first appear on a mounted Root", async () => {
    const trigger = <FileUpload.Trigger>Add files</FileUpload.Trigger>;
    // The same element type in the same place, so React updates the mounted Root.
    const tree = (posting: boolean) => (
      <form aria-label="Upload form">
        {posting ? (
          <FileUpload.Root name="attachments" files={[png("a.png")]}>
            {trigger}
          </FileUpload.Root>
        ) : (
          <FileUpload.Root>{trigger}</FileUpload.Root>
        )}
      </form>
    );
    const { rerender } = renderThemed(tree(false));
    await expect.element(page.getByRole("button", { name: "Add files", exact: true })).toBeInTheDocument();
    expect(posted("Upload form", "attachments")).toEqual([]);

    rerender(tree(true));
    await expect.poll(() => posted("Upload form", "attachments")).toEqual([["a.png", 3]]);
  });

  it("keeps posting the files after a new render element replaces the Root's DOM node", async () => {
    const files = [png("a.png")];
    const tree = (render: ReactElement) => (
      <form aria-label="Upload form">
        <FileUpload.Root render={render} name="attachments" files={files}>
          <FileUpload.Trigger>Add files</FileUpload.Trigger>
        </FileUpload.Root>
      </form>
    );
    const { rerender } = renderThemed(tree(<div />));
    await expect.poll(() => posted("Upload form", "attachments")).toEqual([["a.png", 3]]);

    rerender(tree(<section />));
    await expect.poll(() => formNamed("Upload form").querySelector("section")).not.toBeNull();
    expect(posted("Upload form", "attachments")).toEqual([["a.png", 3]]);
  });

  it("posts under the enclosing Field's name over its own, as Base UI controls do", async () => {
    renderThemed(
      <form aria-label="Upload form">
        <Field.Root name="evidence">
          <Field.Label>Evidence</Field.Label>
          <FileUpload.Root name="attachments" files={[png("a.png")]}>
            <FileUpload.Trigger>Add files</FileUpload.Trigger>
          </FileUpload.Root>
        </Field.Root>
      </form>
    );
    await expect.poll(() => posted("Upload form", "evidence")).toEqual([["a.png", 3]]);
    expect(posted("Upload form", "attachments")).toEqual([]);
  });

  it("runs onSelect for a real pick of the file it posts, after a rejected pick in between", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    function Meter(): ReactElement {
      const [files, setFiles] = useState<readonly File[]>([]);
      const [error, setError] = useState<string | null>(null);
      return (
        <form aria-label="Upload form">
          <FileUpload.Root
            name="meter"
            files={files}
            accept="image/*"
            onSelect={(picked) => {
              onSelect(picked);
              setFiles(picked);
              setError(null);
            }}
            onReject={() => setError("Choose an image.")}>
            <FileUpload.Trigger>Choose photo</FileUpload.Trigger>
          </FileUpload.Root>
          <p>{error ?? "No problems"}</p>
        </form>
      );
    }
    const { host } = renderThemed(<Meter />);
    // A path, not a File, so Playwright selects through Chromium's file chooser path
    // (`DOM.setFileInputFiles`), which fires no `change` when the input already holds that file.
    const picker = page.elementLocator(fileInput(host));
    await userEvent.upload(picker, "test/fixtures/file-upload/meter.png");
    await expect.poll(() => posted("Upload form", "meter")).toEqual([["meter.png", 5]]);
    await userEvent.upload(picker, "test/fixtures/file-upload/notes.txt");
    await expect.element(page.getByText("Choose an image.", { exact: true })).toBeInTheDocument();

    await userEvent.upload(picker, "test/fixtures/file-upload/meter.png");
    await expect.element(page.getByText("No problems", { exact: true })).toBeInTheDocument();
    expect(onSelect.mock.calls.map(([files]) => files.map((file) => file.name))).toEqual([
      ["meter.png"],
      ["meter.png"],
    ]);
    expect(posted("Upload form", "meter")).toEqual([["meter.png", 5]]);
  });

  it("posts nothing without files, even under a Field's name, and nothing while disabled", async () => {
    renderThemed(
      <form aria-label="Upload form">
        <Field.Root name="evidence">
          <Field.Label>Evidence</Field.Label>
          <FileUpload.Root>
            <FileUpload.Trigger>Add files</FileUpload.Trigger>
          </FileUpload.Root>
        </Field.Root>
        <FileUpload.Root name="attachments" files={[png("a.png")]} disabled>
          <FileUpload.Trigger>Add more</FileUpload.Trigger>
        </FileUpload.Root>
      </form>
    );
    await expect.element(page.getByRole("button", { name: "Add more", exact: true })).toBeDisabled();
    expect(posted("Upload form", "evidence")).toEqual([]);
    expect(posted("Upload form", "attachments")).toEqual([]);
  });
});
