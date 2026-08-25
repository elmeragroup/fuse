import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { alertDialogStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "alert-dialog.tsx"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "alert-dialog.ts"), "utf8");

const CANCEL_COPY = {
  "nb-NO": "Avbryt",
  "sv-SE": "Avbryt",
  "en-US": "Cancel",
  "fi-FI": "Peruuta",
} as const;

describe("alert-dialog dictionary", () => {
  it("owns the locked alertDialog.cancel copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(alertDialogStrings.getStringForLocale("cancel", locale), locale).toBe(CANCEL_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to AlertDialog", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(alertDialogStrings.getStringsForLocale(locale)), locale).toEqual(["cancel"]);
    }
  });
});

describe("alert-dialog source contract", () => {
  it("reuses Dialog containment and never falls back to document.body or a local z-50", () => {
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).not.toContain("overlayLayer");
    expect(source).not.toContain("useThemeScopeContainer");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("@base-ui/react/alert-dialog");
    expect(source).not.toMatch(/text-destructive|bg-destructive|border-destructive|ring-destructive/);
  });

  it("keeps the §8 bugfix: the body is a Dialog.Description, not a raw styled div", () => {
    expect(source).toContain("Dialog.Description");
    expect(source).not.toContain('<div className="text-sm text-pretty text-muted-foreground">');
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain("showCloseButton={false}");
    expect(source).toContain("text-error");
    expect(source).toContain("WarningOctagon");
    expect(source).toContain("Info");
    expect(source).toContain("flex-row items-start justify-between gap-4");
    expect(source).toContain('data-dialog-action-type="primary"');
    expect(source).toContain('data-dialog-action-type="secondary"');
  });

  it("emits data-slot before the props spread on Root and Trigger", () => {
    for (const slot of ["alert-dialog", "alert-dialog-trigger"]) {
      expect(source, slot).toContain(`data-slot="${slot}"`);
    }
    for (const part of source.split("function ").slice(1)) {
      const slot = part.indexOf("data-slot=");
      const spread = part.indexOf("{...props}");
      if (slot === -1 || spread === -1) {
        continue;
      }
      expect(slot).toBeLessThan(spread);
    }
  });

  it("starts with the use client directive and keeps the facade directive-free", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("AlertDialogProps");
    expect(facade).toContain("AlertDialogContentProps");
  });
});
