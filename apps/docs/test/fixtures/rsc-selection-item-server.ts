/**
 * The server layer of the SelectionItem Flight fixture. Run under `--conditions=react-server` with
 * the RSC loader, it renders `rsc-selection-item-page.tsx` to a Flight payload on stdout. A render
 * error goes to stderr with exit code 1.
 */
import { createElement } from "react";

import { renderFlight } from "./rsc-flight-server.ts";
import { SelectionItemPage } from "./rsc-selection-item-page.tsx";

const { payload, errors } = await renderFlight(createElement(SelectionItemPage));
if (errors.length > 0) {
  process.stderr.write(`${errors.map((error) => error.message).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(payload);
}
