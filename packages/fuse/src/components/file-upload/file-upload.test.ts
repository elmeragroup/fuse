import { describe, expect, it } from "vitest";

import { itemDefaultShellClass, itemShellClass } from "../../styles/inner-corner/item";
import { labelTypeClass } from "../../styles/label-type";
import { dataStateFaceClass } from "../../styles/state-face";
import { fileUploadVariants } from "./file-upload-variants";

/** A recipe slot's classes as a set, so each expectation reads as one class. */
function classesOf(slot: string): ReadonlySet<string> {
  return new Set(slot.split(/\s+/u).filter(Boolean));
}

const styles = fileUploadVariants();

// FileUpload's own rules from SPEC "Styling" are literal classes. Classes a shared module owns are
// cross-checked against that module's constant, named in each test.
describe("fileUploadVariants", () => {
  it("stacks the Root's parts with a surface gap", () => {
    const root = classesOf(styles.root());
    expect(root).toContain("flex");
    expect(root).toContain("flex-col");
    expect(root).toContain("gap-(--surface-gap-sm)");
  });

  // Unit under test: the dropzone slot, which forwards Item's default shell and the data state
  // face. Oracle: those shared constants, whose classes the slot must carry unchanged.
  it("forwards Item's default shell and the shared disabled face to the Dropzone", () => {
    const zone = classesOf(styles.dropzone());
    for (const shared of [itemShellClass, itemDefaultShellClass, dataStateFaceClass]) {
      for (const name of classesOf(shared)) {
        expect(zone, shared).toContain(name);
      }
    }
  });

  it("dashes the idle Dropzone and lays it out as a centred row", () => {
    const zone = classesOf(styles.dropzone());
    expect(zone).toContain("border-dashed");
    expect(zone).toContain("border-border");
    expect(zone).toContain("gap-(--surface-gap-sm)");
    expect(zone).toContain("flex");
    expect(zone).toContain("items-center");
  });

  it("strengthens the border on hover and while a control inside has keyboard focus", () => {
    const zone = classesOf(styles.dropzone());
    expect(zone).toContain("enabled-hover:border-muted-foreground/50");
    expect(zone).toContain("has-focus-visible:border-muted-foreground/50");
  });

  it("turns a drop target solid primary on the soft primary fill", () => {
    const zone = classesOf(styles.dropzone());
    expect(zone).toContain("data-drop-target:border-solid");
    expect(zone).toContain("data-drop-target:border-primary");
    expect(zone).toContain("data-drop-target:bg-primary-soft");
  });

  it("animates colours only", () => {
    const zone = classesOf(styles.dropzone());
    expect([...zone].filter((name) => name.startsWith("transition-"))).toEqual(["transition-colors"]);
  });

  // Unit under test: the description slot. Oracle: the shared label type pair.
  it("sets the Description in the label type pair, muted", () => {
    const description = classesOf(styles.description());
    for (const name of classesOf(labelTypeClass)) {
      expect(description).toContain(name);
    }
    expect(description).toContain("text-muted-foreground");
  });
});
