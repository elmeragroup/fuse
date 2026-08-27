import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { FileTrigger } from "./file-trigger";

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

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
  it("renders a named button and a hidden file input that receives accept and multiple", () => {
    renderThemed(
      <FileTrigger acceptedFileTypes={["image/png", ".pdf"]} allowsMultiple>
        Attach files
      </FileTrigger>
    );

    const button = buttonNamed("Attach files");
    const input = fileInputFor(button);
    expect(input.getAttribute("type")).toBe("file");
    expect(getComputedStyle(input).display).toBe("none");
    expect(input.getAttribute("accept")).toBe("image/png,.pdf");
    expect(input.hasAttribute("multiple")).toBe(true);
  });

  it("clicks the hidden input from the button and from Enter, and fires onSelect from a change", async () => {
    const onSelect = vi.fn<(files: FileList | null) => void>();
    renderThemed(
      <FileTrigger onSelect={onSelect} acceptedFileTypes={[".pdf"]}>
        Attach files
      </FileTrigger>
    );

    const button = buttonNamed("Attach files");
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

    const attach = buttonNamed("Attach file");
    const photo = buttonNamed("Take photo");
    const folder = buttonNamed("Choose folder");
    const none = buttonNamed("No icon");

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

    const button = buttonNamed("Attach files");
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

  it("lands variant and size classes on the button, not the hidden input", () => {
    renderThemed(
      <>
        <FileTrigger>Attach file</FileTrigger>
        <FileTrigger variant="outline" size="lg">
          Outline large
        </FileTrigger>
      </>
    );

    const defaults = buttonNamed("Attach file");
    const outline = buttonNamed("Outline large");
    expect(defaults.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["bg-primary", "h-(--control-h-sm)", "text-sm", "gap-x-2"])
    );
    expect(outline.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border-border", "h-(--control-h-lg)"])
    );
    expect(outline.className.split(/\s+/)).not.toContain("bg-primary");
    expect(outline.className.split(/\s+/)).not.toContain("h-(--control-h-sm)");

    expect(fileInputFor(defaults).className).not.toContain("bg-primary");
    expect(fileInputFor(outline).className).not.toContain("border-border");
    expect(fileInputFor(outline).className).not.toContain("h-(--control-h-lg)");
  });
});
