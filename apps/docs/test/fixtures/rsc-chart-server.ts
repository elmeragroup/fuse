/**
 * The server layer of the chart Flight fixture. Run under `--conditions=react-server` with the RSC
 * loader, it renders one scenario of `rsc-chart-page.tsx` to a Flight payload on stdout. A render
 * error goes to stderr with exit code 1.
 */
import { createElement } from "react";

import { ChartPage, ComposedPage, FunctionFormatPage } from "./rsc-chart-page.tsx";
import { renderFlight } from "./rsc-flight-server.ts";

const SCENARIOS = new Map([
  ["page", ChartPage],
  ["composed", ComposedPage],
  ["function-format", FunctionFormatPage],
]);
const scenario = process.argv[2] ?? "";
const Page = SCENARIOS.get(scenario);
if (Page === undefined) {
  throw new Error(`unknown scenario ${scenario}`);
}

const { payload, errors } = await renderFlight(createElement(Page));
if (errors.length > 0) {
  process.stderr.write(`${errors.map((error) => error.message).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(payload);
}
