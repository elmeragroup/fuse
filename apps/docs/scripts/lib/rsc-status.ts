/**
 * A module's RSC classification from its leading directive. Generation reviews demos with it and
 * the Live code loader skips server demos with it, so both read the prologue the same way. It
 * imports nothing at runtime, so the loader stays light.
 */

import type { RscStatus } from "../../src/lib/docs-model.ts";

/**
 * RSC classification of a module from its own leading directive.
 *
 * Only a directive in the module prologue counts: comments and other directives
 * (`"use strict"`) may precede it, but the first statement ends the prologue, so a
 * `"use client"` string expression further down does not make the module a client one.
 *
 * @param source - The module's source.
 * @returns `client` when the prologue holds `"use client"`, otherwise `server`.
 */
export function readRscStatus(source: string): RscStatus {
  const prologue = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const line of prologue.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (/^["']use client["'];?$/.test(trimmed)) return "client";
    if (!/^["'][^"']*["'];?$/.test(trimmed)) break;
  }
  return "server";
}
