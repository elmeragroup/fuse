import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { fkasBranded } from "../../../test/theme-fixtures";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { ButtonGroup } from "../button-group";
import { Button } from "../button/button";
import type { FileRejection } from "../file-upload/split-files";
import { FileTrigger } from "./file-trigger";

/** The hidden picker input. It is outside the accessibility tree, so no role or name finds it. */
function fileInput(host: HTMLElement): HTMLInputElement {
  const input = host.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("expected FileTrigger's hidden file input");
  }
  return input;
}

/** Stubs the hidden input's `click`, which would open the picker, and returns the spy. */
function stubPicker(host: HTMLElement) {
  return vi.spyOn(fileInput(host), "click").mockReturnValue(undefined);
}

/** Picks `files` the way the browser does: it sets `input.files`, then fires `change`. */
function pick(input: HTMLInputElement, files: readonly File[]): void {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function svgPaths(root: ParentNode): string {
  return [...root.querySelectorAll("svg path")].map((path) => path.getAttribute("d") ?? "").join("|");
}

const png = (name: string) => new File(["png"], name, { type: "image/png" });
const txt = (name: string) => new File(["txt"], name, { type: "text/plain" });
const pdf = (name: string) => new File(["pdf"], name, { type: "" });

/** The edges a ButtonGroup joins: each corner's radius and the leading border. */
function joinedEdges(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    topLeft: style.borderTopLeftRadius,
    bottomLeft: style.borderBottomLeftRadius,
    topRight: style.borderTopRightRadius,
    bottomRight: style.borderBottomRightRadius,
    borderLeft: style.borderLeftWidth,
  };
}

/** A rejection as `[reason, file name]`. */
function described(rejection: FileRejection): readonly [string, string] {
  return "file" in rejection ? [rejection.reason, rejection.file.name] : [rejection.reason, rejection.name];
}

describe("FileTrigger", () => {
  it("is a button named by its children that opens the picker on click, Enter and Space, without submitting a form", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const { host } = renderThemed(
      <form aria-label="Upload form">
        <FileTrigger>Attach files</FileTrigger>
      </form>
    );
    formNamed("Upload form").addEventListener("submit", onSubmit);
    const click = stubPicker(host);

    await userEvent.click(page.getByRole("button", { name: "Attach files", exact: true }));
    expect(click).toHaveBeenCalledTimes(1);

    roleNamed("button", "Attach files").focus();
    await userEvent.keyboard("{Enter}");
    expect(click).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(" ");
    expect(click).toHaveBeenCalledTimes(3);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("gives onSelect a fresh array of the picked Files for each pick, which the next pick leaves intact", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host } = renderThemed(
      <FileTrigger multiple onSelect={onSelect}>
        Attach files
      </FileTrigger>
    );
    const input = fileInput(host);
    const first = [png("a.png"), png("b.png")];
    pick(input, first);
    pick(input, [png("c.png")]);

    const [firstPick, secondPick] = onSelect.mock.calls.map(([files]) => files);
    expect(Array.isArray(firstPick)).toBe(true);
    expect(firstPick).toEqual(first);
    expect(firstPick?.[0]).toBe(first[0]);
    expect(secondPick?.map((file) => file.name)).toEqual(["c.png"]);
    expect(secondPick).not.toBe(firstPick);
  });

  it("selects the files that pass accept and rejects the rest with reason type", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    const { host } = renderThemed(
      <FileTrigger accept="image/*, .pdf" multiple onSelect={onSelect} onReject={onReject}>
        Attach files
      </FileTrigger>
    );
    pick(fileInput(host), [png("a.png"), txt("notes.txt"), pdf("b.pdf")]);

    expect(onSelect.mock.calls.map(([files]) => files.map((file) => file.name))).toEqual([
      ["a.png", "b.pdf"],
    ]);
    expect(onReject.mock.calls.map(([rejections]) => rejections.map(described))).toEqual([
      [["type", "notes.txt"]],
    ]);
  });

  it("rejects every file with reason count when a single-file trigger receives several", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    const { host } = renderThemed(
      <FileTrigger onSelect={onSelect} onReject={onReject}>
        Attach file
      </FileTrigger>
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

  it("checks accept before the count, so a single-file trigger selects the one file of a mixed pick that passes", () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const onReject = vi.fn<(rejections: FileRejection[]) => void>();
    const { host } = renderThemed(
      <FileTrigger accept="image/*" onSelect={onSelect} onReject={onReject}>
        Attach file
      </FileTrigger>
    );
    pick(fileInput(host), [png("a.png"), txt("notes.txt")]);

    expect(onSelect.mock.calls.map(([files]) => files.map((file) => file.name))).toEqual([["a.png"]]);
    expect(onReject.mock.calls.map(([rejections]) => rejections.map(described))).toEqual([
      [["type", "notes.txt"]],
    ]);
  });

  it("leaves a paste alone while its button has focus, as only FileUpload takes pastes", () => {
    renderThemed(<FileTrigger>Attach file</FileTrigger>);
    roleNamed("button", "Attach file").focus();
    const transfer = new DataTransfer();
    transfer.items.add(png("a.png"));
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer });
    document.body.dispatchEvent(event);
    // FileUpload cancels a paste it takes before it reads the files, so an uncancelled paste was
    // never taken.
    expect(event.defaultPrevented).toBe(false);
  });

  it("writes accept, multiple, capture and webkitdirectory on the hidden input", () => {
    const { host } = renderThemed(
      <FileTrigger accept="image/*,.pdf" multiple directory capture="environment">
        Attach files
      </FileTrigger>
    );
    const input = fileInput(host);
    expect(input.accept).toBe("image/*,.pdf");
    expect(input.multiple).toBe(true);
    expect(input.getAttribute("capture")).toBe("environment");
    expect(input.webkitdirectory).toBe(true);
    expect(input.hasAttribute("name")).toBe(false);
  });

  it("disables the button, opens no picker and selects nothing while disabled", async () => {
    const onSelect = vi.fn<(files: File[]) => void>();
    const { host } = renderThemed(
      <FileTrigger disabled onSelect={onSelect}>
        Attach files
      </FileTrigger>
    );
    const click = stubPicker(host);
    await expect.element(page.getByRole("button", { name: "Attach files", exact: true })).toBeDisabled();
    await userEvent.click(roleNamed("button", "Attach files"), { force: true });
    expect(click).not.toHaveBeenCalled();

    pick(fileInput(host), [png("a.png")]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(["first", "middle", "last"] as const)(
    "joins a ButtonGroup as a grouped Button does when it is the %s child",
    (position) => {
      const children = (trigger: "file" | "button") =>
        ["first", "middle", "last"].map((slot) =>
          slot !== position ? (
            <Button key={slot} variant="outline">
              {`${trigger} ${slot}`}
            </Button>
          ) : trigger === "file" ? (
            <FileTrigger key={slot} variant="outline" size="default">
              Attach
            </FileTrigger>
          ) : (
            <Button key={slot} variant="outline">
              Plain
            </Button>
          )
        );
      // The branded theme rounds buttons, so a corner the group joins differs from one it keeps.
      renderThemed(
        <ThemeScope theme={fkasBranded}>
          <ButtonGroup.Root aria-label="With FileTrigger">{children("file")}</ButtonGroup.Root>
          <ButtonGroup.Root aria-label="With Button">{children("button")}</ButtonGroup.Root>
        </ThemeScope>
      );
      const expected = joinedEdges(roleNamed("button", "Plain"));
      // The oracle is a real join: the plain Button's joined side is square, its outer side round.
      const joined = position === "first" ? expected.topRight : expected.topLeft;
      const outer = position === "first" ? expected.topLeft : expected.topRight;
      expect(joined).toBe("0px");
      if (position !== "middle") {
        expect(parseFloat(outer)).toBeGreaterThan(0);
      }
      expect(joinedEdges(roleNamed("button", "Attach"))).toEqual(expected);
    }
  );

  it("forwards ref to the visible button", () => {
    const ref = createRef<HTMLButtonElement>();
    renderThemed(<FileTrigger ref={ref}>Attach files</FileTrigger>);
    expect(ref.current).toBe(roleNamed("button", "Attach files"));
  });

  it("selects a distinct decorative icon per mode, and omits the icon when withIcon is false", () => {
    renderThemed(
      <>
        <FileTrigger>Attach file</FileTrigger>
        <FileTrigger capture="user">Take photo</FileTrigger>
        <FileTrigger directory>Choose folder</FileTrigger>
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
