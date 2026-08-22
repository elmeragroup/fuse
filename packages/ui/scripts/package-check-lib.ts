/**
 * Packed-export and packed-asset checks shared by package-check and its tests.
 * Comparison is exact-set: extra names fail the same way missing names do.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackedEvalJson = { ok: true; value: unknown } | { ok: false; failure: string };

export function parsePackedEvalJson(text: string, context: string): PackedEvalJson {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, failure: `Packed import JSON parse failed for ${context}` };
  }
}

export function packedValueExportFailure(
  entryKey: string,
  packedNames: readonly string[],
  expectedNames: readonly string[]
): string | undefined {
  const packed = new Set(packedNames);
  const expected = new Set(expectedNames);
  const missing = expectedNames.filter((name) => !packed.has(name));
  const extra = packedNames.filter((name) => !expected.has(name));
  if (missing.length === 0 && extra.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`missing runtime exports: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    parts.push(`unexpected runtime exports: ${extra.join(", ")}`);
  }
  return `${entryKey} ${parts.join("; ")}`;
}

export function leadingUseClient(source: string): boolean {
  return /^["']use client["']\s*;?/.test(source.replace(/^\uFEFF/, "").trimStart());
}

export function emittedDirectiveFailure(
  extracted: string,
  sourceFiles: readonly string[],
  packageRoot: string
): string | undefined {
  for (const sourceFile of sourceFiles) {
    const sourceHasDirective = leadingUseClient(readFileSync(join(packageRoot, sourceFile), "utf8"));
    const relative = sourceFile.replace(/^src\//, "");
    const packedJs = join(extracted, relative.replace(/\.(tsx|ts)$/u, ".js"));
    if (!existsSync(packedJs)) {
      if (sourceHasDirective) {
        return `Source ${relative} has "use client" but no packed JS counterpart`;
      }
      continue;
    }
    const packedHasDirective = leadingUseClient(readFileSync(packedJs, "utf8"));
    if (sourceHasDirective !== packedHasDirective) {
      return `Directive mismatch for ${relative}: source ${sourceHasDirective ? "has" : "lacks"} "use client", packed ${packedHasDirective ? "has" : "lacks"} it`;
    }
  }
  return undefined;
}
