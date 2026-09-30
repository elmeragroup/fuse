"use client";

import { createTableHookContexts } from "@tanstack/react-table";
import type { StockFeatures } from "@tanstack/react-table";

/**
 * Fuse's own table, header and cell contexts, passed to every `createTableHook` call Fuse makes.
 * They isolate the registered parts from an app that also calls `createTableHook` with TanStack's
 * shared default contexts. One module-level set is enough: a nested Fuse table's provider shadows
 * the outer one, which is right for the parts rendered inside it.
 *
 * The hooks are typed with every stock feature. A registered part reads a feature's members only
 * when its public type is present, which the factory ties to that feature being registered.
 */
export const fuseTableContexts = createTableHookContexts<StockFeatures>();
