// Unit under test: the demos of the chart family pages. Oracle: Chartability heuristic 30 as
// CONTRACT.md section 9.11 sets it. Every demo that mounts a chart Root also mounts the family's
// Table, unless it is an evilcharts parity demo, which reproduces its source's geometry and names
// its example in the attribution comment.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

/** The pages whose family layer has landed. Each later family layer adds its page here. */
const PAGES = ["bar-chart", "chart"] as const;

const PARITY = "The rows and labels below come from the evilcharts example";

describe("the chart demos' tables", () => {
  it.each(PAGES)("mounts a Table in every interactive %s demo other than a parity demo", (slug) => {
    const directory = path.join(docsRoot, "src/app/(docs)/components", slug, "demos");
    const missing = readdirSync(directory)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => {
        const source = readFileSync(path.join(directory, file), "utf8");
        const mountsRoot = /<[A-Za-z]*Chart\.Root\b/u.test(source);
        return mountsRoot && !source.includes(PARITY) && !/<[A-Za-z]*Chart\.Table\b/u.test(source);
      });
    expect(missing).toEqual([]);
  });
});
