import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { formNamed, renderThemed, roleNamed, textNamed } from "../../../test/themed-browser-render";
import { isHTMLElement } from "../../internal/dom-node";
import { Button } from "../button/button";
import { Slider } from "../slider/slider";
import { useFileUpload } from "./file-upload-context";
import { FileUpload } from "./index";
import type { FileRejection } from "./split-files";

/** The Root's hidden input. It has no role or name to query it by. */
function fileInput(host: HTMLElement): HTMLInputElement {
  // DOM audit: the picker input is `hidden`, so it is outside the accessibility tree.
  const input = host.querySelector('input[type="file"]');
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

  it("rejects both files of a two-file pick with count on a single-file Root", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    const { host } = renderThemed(
      <FileUpload.Root onSelect={onSelect} onReject={onReject}>
        <FileUpload.Trigger>Add file</FileUpload.Trigger>
      </FileUpload.Root>
    );
    pick(fileInput(host), [png("a.png"), png("b.png")]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject.mock.calls.map(([rejections]) => rejections.map(described))).toEqual([
      [
        ["count", "a.png"],
        ["count", "b.png"],
      ],
    ]);
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
  });

  it("keeps a consumer id on the Description and describes the Trigger with it", async () => {
    renderThemed(
      <FileUpload.Root>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <FileUpload.Description id="limits">Up to 3 files.</FileUpload.Description>
      </FileUpload.Root>
    );
    const trigger = page.getByRole("button", { name: "Add files", exact: true });
    await expect.element(trigger).toHaveAccessibleDescription("Up to 3 files.");
    expect(trigger.element().getAttribute("aria-describedby")).toBe("limits");
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

  it("delivers files a child adds in its mount effect, which runs before the Root's", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    function AddOnMount(): null {
      const { actions } = useFileUpload();
      useEffect(() => {
        actions.add([sample]);
      }, [actions]);
      return null;
    }
    renderThemed(
      <FileUpload.Root onSelect={onSelect}>
        <AddOnMount />
      </FileUpload.Root>
    );
    expect(onSelect.mock.calls).toEqual([[[sample]]]);
    expect(onSelect.mock.calls[0]?.[0][0]).toBe(sample);
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
  // DOM audit: the Root and Dropzone are plain divs, and data-drop-target is their public state.
  const root = host.querySelector('[data-slot="file-upload"]');
  const zone = host.querySelector('[data-slot="file-upload-dropzone"]');
  if (!isHTMLElement(root) || !isHTMLElement(zone)) {
    throw new Error("expected a FileUpload.Root holding a FileUpload.Dropzone");
  }
  return { root, zone };
}

/**
 * Records each `dropEffect` a handler writes. Chromium and WebKit ignore that write on a
 * constructed `DataTransfer` and always read back "none" (`.scratch/file-drop-zone/probes-t2/
 * probe-drop-effect.mjs`), so without the record a "none" assertion passes whatever the handler
 * does. An own accessor on the instance shadows the prototype's.
 */
type DropEffectRecord = { readonly written: string[] };

function recordDropEffect(transfer: DataTransfer): DropEffectRecord {
  const written: string[] = [];
  Object.defineProperty(transfer, "dropEffect", {
    configurable: true,
    get: () => written.at(-1) ?? "none",
    set: (value: string) => {
      written.push(value);
    },
  });
  return { written };
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

  it("forgets an entered child that left the DOM, which never fires its own dragleave", async () => {
    const tree = (withHint: boolean) => (
      <FileUpload.Root>
        <FileUpload.Dropzone>
          <FileUpload.Trigger>Add files</FileUpload.Trigger>
          {withHint ? <span>Drop here</span> : null}
        </FileUpload.Dropzone>
      </FileUpload.Root>
    );
    const { host, rerender } = renderThemed(tree(true));
    const { zone } = parts(host);
    const transfer = fileTransfer([png("a.png")]);
    drag(zone, "dragenter", transfer);
    drag(textNamed("Drop here"), "dragenter", transfer);
    rerender(tree(false));
    drag(zone, "dragleave", transfer);
    await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(false);
  });

  it("keeps the Root dragging while one zone shows a drop target and another zone unmounts", async () => {
    const tree = (withSecond: boolean) => (
      <FileUpload.Root multiple>
        <FileUpload.Dropzone>
          <FileUpload.Trigger>Add files</FileUpload.Trigger>
        </FileUpload.Dropzone>
        {withSecond ? (
          <FileUpload.Dropzone>
            <FileUpload.Trigger>Add more</FileUpload.Trigger>
          </FileUpload.Dropzone>
        ) : null}
      </FileUpload.Root>
    );
    const { host, rerender } = renderThemed(tree(true));
    const { root, zone } = parts(host);
    drag(zone, "dragenter", fileTransfer([png("a.png")]));
    await expect.poll(() => root.hasAttribute("data-dragging")).toBe(true);
    rerender(tree(false));
    // The removed zone's cleanup schedules its state update, which React renders by the next frames.
    await nextFrames(2);
    expect(zone.hasAttribute("data-drop-target")).toBe(true);
    expect(root.hasAttribute("data-dragging")).toBe(true);
  });

  it.each(["dragleave", "drop"] as const)(
    "forgets a drag that ends with %s while the Root is disabled, so re-enabling shows no highlight",
    async (ending) => {
      const onSelect = vi.fn<(files: File[]) => void>();
      const { host, rerender } = renderThemed(<Zone onSelect={onSelect} />);
      const { root, zone } = parts(host);
      const transfer = fileTransfer([png("a.png")]);
      drag(zone, "dragenter", transfer);
      await expect.poll(() => zone.hasAttribute("data-drop-target")).toBe(true);
      rerender(<Zone disabled onSelect={onSelect} />);
      drag(zone, ending, transfer);
      rerender(<Zone onSelect={onSelect} />);
      await nextFrames(2);
      expect(zone.hasAttribute("data-drop-target")).toBe(false);
      expect(root.hasAttribute("data-dragging")).toBe(false);
      expect(onSelect).not.toHaveBeenCalled();
    }
  );

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

  it("leaves a drag on portalled content to the document, though React bubbles it to the zone", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    function PortalledPanel(): ReactElement {
      return createPortal(<p>Portalled panel</p>, document.body);
    }
    const { host } = renderThemed(
      <FileUpload.Root onSelect={onSelect}>
        <FileUpload.Dropzone>
          <FileUpload.Trigger>Add files</FileUpload.Trigger>
          <PortalledPanel />
        </FileUpload.Dropzone>
      </FileUpload.Root>
    );
    const { zone } = parts(host);
    const panel = textNamed("Portalled panel");
    const transfer = fileTransfer([png("a.png")]);
    const effect = recordDropEffect(transfer);
    drag(panel, "dragenter", transfer);
    drag(panel, "dragover", transfer);
    // The document guard answers the drag outside every zone.
    expect(effect.written).toEqual(["none"]);
    expect(drag(panel, "drop", transfer).defaultPrevented).toBe(true);
    await nextFrames(2);
    expect(zone.hasAttribute("data-drop-target")).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("discards a drop whose files resolve after the Root unmounted", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host, unmount } = renderThemed(<Zone onSelect={onSelect} />);
    const { zone } = parts(host);
    const transfer = fileTransfer([png("a.png")]);
    drag(zone, "dragenter", transfer);
    drag(zone, "drop", transfer);
    unmount();
    await nextFrames(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("refuses a drag it can tell will be rejected, by type or by count", async () => {
    const { host } = renderThemed(
      <>
        <Zone accept="image/*" multiple />
        <Zone />
      </>
    );
    // DOM audit: two Roots, each with one Dropzone, in document order.
    const [typed, single] = [...host.querySelectorAll('[data-slot="file-upload-dropzone"]')];
    if (!(typed instanceof HTMLElement) || !(single instanceof HTMLElement)) {
      throw new Error("expected two Dropzones");
    }

    const zip = fileTransfer([new File(["zip"], "a.zip", { type: "application/zip" })]);
    const zipEffect = recordDropEffect(zip);
    drag(typed, "dragenter", zip);
    const zipOver = drag(typed, "dragover", zip);
    expect(zipOver.defaultPrevented).toBe(true);
    expect(zipEffect.written).toEqual(["none", "none"]);

    const pair = fileTransfer([png("a.png"), png("b.png")]);
    const pairEffect = recordDropEffect(pair);
    drag(single, "dragenter", pair);
    drag(single, "dragover", pair);
    expect(pairEffect.written).toEqual(["none", "none"]);
    expect(single.hasAttribute("data-drop-target")).toBe(false);

    const one = fileTransfer([png("a.png")]);
    const oneEffect = recordDropEffect(one);
    drag(single, "dragenter", one);
    drag(single, "dragover", one);
    expect(oneEffect.written).toEqual(["copy", "copy"]);
    await expect.poll(() => single.hasAttribute("data-drop-target")).toBe(true);
    expect(typed.hasAttribute("data-drop-target")).toBe(false);
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

  it("opens the picker from a click on its empty surface, never from a control inside it", async () => {
    const { host } = renderThemed(<Zone />);
    const { zone } = parts(host);
    const click = stubPicker(host);

    zone.click();
    expect(click).toHaveBeenCalledTimes(1);
    await userEvent.click(roleNamed("button", "Add files"));
    expect(click).toHaveBeenCalledTimes(2);
    await userEvent.click(roleNamed("button", "Clear list"));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("leaves a click to a disclosure, to portalled content, and to a text selection inside the zone", () => {
    function PortalledNote(): ReactElement {
      return createPortal(<p>Portalled note</p>, document.body);
    }
    const { host } = renderThemed(
      <FileUpload.Root>
        <FileUpload.Dropzone>
          <details>
            <summary>More</summary>
          </details>
          <PortalledNote />
          <FileUpload.Description>Images only</FileUpload.Description>
        </FileUpload.Dropzone>
      </FileUpload.Root>
    );
    const click = stubPicker(host);

    textNamed("More").click();
    textNamed("Portalled note").click();
    const hint = textNamed("Images only");
    const selection = window.getSelection();
    selection?.selectAllChildren(hint);
    hint.click();
    selection?.removeAllRanges();
    expect(click).not.toHaveBeenCalled();

    hint.click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("opens only the inner Root's picker from a click on a nested zone's surface", () => {
    const { host } = renderThemed(
      <FileUpload.Root>
        <FileUpload.Dropzone>
          <FileUpload.Root>
            <FileUpload.Dropzone>
              <FileUpload.Description>Item attachments</FileUpload.Description>
            </FileUpload.Dropzone>
          </FileUpload.Root>
        </FileUpload.Dropzone>
      </FileUpload.Root>
    );
    // DOM audit: each Root renders its hidden input last, so the outer one is the second in order.
    const [innerInput, outerInput] = host.querySelectorAll('input[type="file"]');
    if (!(innerInput instanceof HTMLInputElement) || !(outerInput instanceof HTMLInputElement)) {
      throw new Error("expected two hidden file inputs");
    }
    const inner = vi.spyOn(innerInput, "click").mockReturnValue(undefined);
    const outer = vi.spyOn(outerInput, "click").mockReturnValue(undefined);

    textNamed("Item attachments").click();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it("leaves a click on a Slider track inside the zone to the Slider", async () => {
    const { host } = renderThemed(
      withLocale(
        "en-US",
        <FileUpload.Root>
          <FileUpload.Dropzone>
            <div style={{ width: 160 }}>
              <Slider aria-label="Quality" defaultValue={0} />
            </div>
          </FileUpload.Dropzone>
        </FileUpload.Root>
      )
    );
    const click = stubPicker(host);
    // DOM audit: the slider's track has no role; a pointer press on it is what moves the thumb.
    const control = roleNamed("slider", "Quality").closest("[data-slot=slider-control]");
    if (!isHTMLElement(control)) {
      throw new Error("expected the slider control");
    }
    const { width, height } = control.getBoundingClientRect();
    await userEvent.click(control, { position: { x: width - 2, y: height / 2 } });
    expect(roleNamed("slider", "Quality")).not.toHaveProperty("value", "0");
    expect(click).not.toHaveBeenCalled();
  });

  it("paints the shared focus ring on a Button Trigger inside the zone, at both densities", async () => {
    const { host } = renderThemed(
      <>
        <button type="button">Before</button>
        <FileUpload.Root>
          <FileUpload.Dropzone>
            <FileUpload.Trigger render={<Button size="sm" />}>Add files</FileUpload.Trigger>
          </FileUpload.Dropzone>
        </FileUpload.Root>
      </>
    );
    stubPicker(host);
    await assertFocusRingAtBothDensities(roleNamed("button", "Before"), roleNamed("button", "Add files"));
  });
});

describe("the document drop guard", () => {
  it("keeps a file drop outside every zone from opening the file while a Root is mounted", () => {
    const first = renderThemed(<Zone />);
    const second = renderThemed(<Zone />);
    const outside = document.createElement("div");
    document.body.append(outside);
    try {
      expect(drag(outside, "drop", fileTransfer([png("a.png")])).defaultPrevented).toBe(true);
      const over = fileTransfer([png("a.png")]);
      const overEffect = recordDropEffect(over);
      expect(drag(outside, "dragover", over).defaultPrevented).toBe(true);
      expect(overEffect.written).toEqual(["none"]);

      const text = new DataTransfer();
      text.setData("text/plain", "hello");
      expect(drag(outside, "drop", text).defaultPrevented).toBe(false);

      first.unmount();
      expect(drag(outside, "drop", fileTransfer([png("a.png")])).defaultPrevented).toBe(true);
      second.unmount();
      expect(drag(outside, "drop", fileTransfer([png("a.png")])).defaultPrevented).toBe(false);
    } finally {
      outside.remove();
    }
  });

  it("leaves a file drag that another handler already cancelled to that handler", () => {
    renderThemed(
      <FileUpload.Root>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}>
          Custom target
        </div>
      </FileUpload.Root>
    );
    const transfer = fileTransfer([png("a.png")]);
    const effect = recordDropEffect(transfer);
    expect(drag(textNamed("Custom target"), "dragover", transfer).defaultPrevented).toBe(true);
    expect(effect.written.at(-1)).toBe("copy");
  });
});

describe("FileUpload across shadow roots and frames", () => {
  it("takes a paste while its Trigger has focus inside an open shadow root", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const shadowHost = document.createElement("div");
    document.body.append(shadowHost);
    const mount = document.createElement("div");
    shadowHost.attachShadow({ mode: "open" }).append(mount);
    try {
      renderThemed(
        createPortal(
          <FileUpload.Root onSelect={onSelect}>
            <FileUpload.Trigger>Add files</FileUpload.Trigger>
          </FileUpload.Root>,
          mount
        )
      );
      roleNamed("button", "Add files").focus();
      expect(paste(document.body, [png("a.png")]).defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    } finally {
      shadowHost.remove();
    }
  });

  it("leaves the paste to a text field inside a shadow root within the Root", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    function ShadowField(): ReactElement {
      const [mount, setMount] = useState<HTMLElement | null>(null);
      return (
        <div
          ref={(host) => {
            if (host !== null && host.shadowRoot === null) {
              const inner = document.createElement("div");
              host.attachShadow({ mode: "open" }).append(inner);
              setMount(inner);
            }
          }}>
          {mount === null ? null : createPortal(<input aria-label="Caption" />, mount)}
        </div>
      );
    }
    renderThemed(
      <FileUpload.Root onSelect={onSelect}>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <ShadowField />
      </FileUpload.Root>
    );
    const field = roleNamed("textbox", "Caption");
    field.focus();
    expect(paste(field, [png("a.png")]).defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("listens, clicks and guards in the frame document a portal renders it into", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) {
      throw new Error("expected a same-origin frame document");
    }
    try {
      renderThemed(createPortal(<Zone onSelect={onSelect} />, frameDocument.body));
      // DOM audit: page queries stop at the frame boundary, so the frame's parts are found in its DOM.
      const { zone } = parts(frameDocument.body);
      const trigger = frameDocument.querySelector("button");
      const input = frameDocument.querySelector('input[type="file"]');
      if (!isHTMLElement(trigger) || !isHTMLElement(input)) {
        throw new Error("expected the Trigger and the input in the frame");
      }
      const click = vi.spyOn(input, "click").mockReturnValue(undefined);

      zone.click();
      expect(click).toHaveBeenCalledTimes(1);

      trigger.focus();
      expect(paste(frameDocument.body, [png("a.png")]).defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));

      expect(drag(frameDocument.body, "drop", fileTransfer([png("b.png")])).defaultPrevented).toBe(true);
    } finally {
      frame.remove();
    }
  });
});
