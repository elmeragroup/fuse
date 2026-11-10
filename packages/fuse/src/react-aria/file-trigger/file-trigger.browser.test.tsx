import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { FileTrigger } from "./file-trigger";

function fileInputFor(button: HTMLElement): HTMLInputElement {
  let node: ChildNode | null = button.nextSibling;
  while (node) {
    if (node instanceof HTMLInputElement && node.type === "file") {
      return node;
    }
    node = node.nextSibling;
  }
  throw new Error("expected a hidden file input beside the button");
}

function svgPaths(root: ParentNode): string {
  return [...root.querySelectorAll("svg path")].map((path) => path.getAttribute("d") ?? "").join("|");
}

function assignFiles(input: HTMLInputElement, files: File[]): void {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  input.files = transfer.files;
}

describe("FileTrigger", () => {
  it("clicks the hidden input from the button and from Enter, and fires onSelect from a change", async () => {
    const onSelect = vi.fn<(files: FileList | null) => void>();
    renderThemed(
      <FileTrigger onSelect={onSelect} acceptedFileTypes={[".pdf"]}>
        Attach files
      </FileTrigger>
    );

    const button = roleNamed("button", "Attach files");
    const input = fileInputFor(button);
    const click = vi.spyOn(input, "click");

    await userEvent.click(page.getByRole("button", { name: "Attach files", exact: true }));
    expect(click).toHaveBeenCalledTimes(1);

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(click).toHaveBeenCalledTimes(2);

    const file = new File(["invoice"], "invoice.pdf", { type: "application/pdf" });
    assignFiles(input, [file]);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls.at(0)?.at(0);
    if (!(selected instanceof FileList)) {
      throw new Error("expected onSelect to receive a FileList");
    }
    expect(selected).toHaveLength(1);
    expect(selected[0]?.name).toBe("invoice.pdf");
  });

  it("selects a distinct decorative icon per mode, and omits the icon when withIcon is false", () => {
    renderThemed(
      <>
        <FileTrigger>Attach file</FileTrigger>
        <FileTrigger defaultCamera="user">Take photo</FileTrigger>
        <FileTrigger acceptDirectory>Choose folder</FileTrigger>
        <FileTrigger withIcon={false}>No icon</FileTrigger>
      </>
    );

    const attach = roleNamed("button", "Attach file");
    const photo = roleNamed("button", "Take photo");
    const folder = roleNamed("button", "Choose folder");
    const none = roleNamed("button", "No icon");

    expect(attach.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(photo.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(folder.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(none.querySelector("svg")).toBeNull();

    const paperclip = svgPaths(attach);
    const camera = svgPaths(photo);
    const directory = svgPaths(folder);
    expect(paperclip.length).toBeGreaterThan(0);
    expect(camera).not.toBe(paperclip);
    expect(directory).not.toBe(paperclip);
    expect(directory).not.toBe(camera);
  });

  it("disables the button and never puts isDisabled on the hidden input", async () => {
    const onSelect = vi.fn();
    renderThemed(
      <FileTrigger isDisabled onSelect={onSelect}>
        Attach files
      </FileTrigger>
    );

    const button = roleNamed("button", "Attach files");
    const input = fileInputFor(button);
    expect(button).toHaveAttribute("data-disabled");
    expect(button).toHaveAttribute("disabled");
    expect(input.hasAttribute("disabled")).toBe(false);
    expect(input.hasAttribute("isDisabled")).toBe(false);

    const click = vi.spyOn(input, "click");
    await userEvent.click(page.getByRole("button", { name: "Attach files", exact: true }), {
      force: true,
    });
    expect(click).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <FileTrigger>Attach files</FileTrigger>
      </>
    );

    await assertFocusRingAtBothDensities(roleNamed("button", "Before"), roleNamed("button", "Attach files"));
  });
});
