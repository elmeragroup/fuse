import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { toastStrings } from "./intl";
import { Toast } from "./toast";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "toast.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "toast-variants.ts"), "utf8");
const facade = readFileSync(join(here, "../../toast.ts"), "utf8");
const overlayClassesSource = readFileSync(join(here, "../overlay/overlay-classes.ts"), "utf8");

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

describe("toast dictionary", () => {
  it("owns the locked toast.close copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(toastStrings.getStringForLocale("close", locale), locale).toBe(CLOSE_COPY[locale]);
    }
  });

  it("carries no key beyond the one row accessibility.md §4.1 assigns to Toast", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(toastStrings.getStringsForLocale(locale)), locale).toEqual(["close"]);
    }
  });
});

describe("toast manager adapter", () => {
  it("createToastManager works from non-React code", () => {
    const manager = Toast.createToastManager();
    const id = manager.add({ title: "Saved", description: "Outside the tree.", timeout: 0 });
    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
    manager.update(id, { description: "Updated from a timer." });
    manager.close(id);
    expect(manager).not.toHaveProperty("toasts");
  });

  it("promise() returns the settled value without a React tree", async () => {
    const manager = Toast.createToastManager();
    await expect(
      manager.promise(Promise.resolve("ok"), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      })
    ).resolves.toBe("ok");
    await expect(
      manager.promise(Promise.reject(new Error("boom")), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      })
    ).rejects.toThrow("boom");
  });
});

describe("toast source contract", () => {
  it("declares the overlay layer once and never falls back to document.body", () => {
    expect(overlayClassesSource.match(/z-50/gu)).toHaveLength(1);
    expect(source).not.toContain("z-50");
    expect(source).toContain("overlayLayer");
    expect(source).toContain("isolate");
    expect(source).toContain("useThemeScopeContainer");
    expect(source).toContain("resolvedContainer === null");
    expect(source).not.toContain("document.body");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("sonner");
    expect(source).not.toContain("Toaster");
    expect(source).not.toContain("TOAST_STYLE");
    expect(source).not.toContain("INVERTED");
    expect(source).not.toContain("richColors");
  });

  it("keeps the recipe module-private and status chrome on -soft tokens", () => {
    expect(existsSync(join(here, "toast-variants.ts"))).toBe(true);
    expect(facade).not.toMatch(/export \{[^}]*toastVariants/);
    expect(source).not.toContain("export { toastVariants");
    expect(variantsSource).toContain("status: {");
    expect(variantsSource).toContain("bg-error-soft");
    expect(variantsSource).toContain("bg-info-soft");
    expect(variantsSource).toContain("bg-success-soft");
    expect(variantsSource).toContain("bg-warning-soft");
    expect(variantsSource).toContain("bg-popover");
    expect(variantsSource).toContain("[transition:transform_0.2s_cubic-bezier(0.22,1,0.36,1),opacity_0.2s]");
    expect(variantsSource).not.toContain("height_0.15s");
    expect(variantsSource).not.toContain("0.5s");
    expect(variantsSource).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
  });

  it("uses Phosphor regular icons and always renders Close through Button", () => {
    expect(source).toContain('from "../../icons/generated/warning-octagon"');
    expect(source).toContain('from "../../icons/generated/info"');
    expect(source).toContain('from "../../icons/generated/check-circle"');
    expect(source).toContain('from "../../icons/generated/warning"');
    expect(source).toContain('from "../../icons/generated/spinner-gap"');
    expect(source).toContain('from "../../icons/generated/x"');
    expect(source).not.toContain("weight=");
    expect(source).not.toContain('weight="fill"');
    expect(source).toContain("render={");
    expect(source).toContain('variant="ghost"');
    expect(source).toContain("sr-only");
    expect(variantsSource).toContain("animate-spin");
    expect(source).toContain("{...props}");
  });

  it("shares one priority adapter across both manager faces", () => {
    expect(source).toContain("wrapManagerMethods");
    expect(source).toContain('type === "error" ? "high" : "low"');
    expect(source).toContain("ToastPrimitive.useToastManager");
    expect(source).toContain("ToastPrimitive.createToastManager");
    expect(source).toContain("adaptAddOptions");
    expect(source).toContain("adaptUpdateOptions");
    expect(source).toContain("adaptPromiseOption");
  });

  it("emits data-slot before the props spread on every rendering part", () => {
    for (const slot of [
      "toast-viewport",
      "toast-root",
      "toast-content",
      "toast-title",
      "toast-description",
      "toast-action",
      "toast-close",
    ]) {
      expect(source, slot).toContain(`data-slot="${slot}"`);
    }
    for (const slot of [
      "toast-viewport",
      "toast-root",
      "toast-content",
      "toast-title",
      "toast-description",
      "toast-action",
      "toast-close",
    ]) {
      const marker = `data-slot="${slot}"`;
      const at = source.indexOf(marker);
      expect(source.indexOf("{...props}", at), slot).toBeGreaterThan(at);
    }
  });

  it("starts with the use client directive and keeps the facade directive-free", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(facade.trimStart().startsWith("export") || facade.trimStart().startsWith("//")).toBe(true);
    expect(facade).not.toContain("use client");
    expect(facade).toContain('export { Toast } from "./components/toast/toast"');
    expect(facade).not.toContain("export * from");
  });
});
