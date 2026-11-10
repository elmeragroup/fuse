import { ruleTester } from "../rule-tester.ts";
import { noDisplayNameAssignment } from "./no-display-name-assignment.ts";

ruleTester.run("no-display-name-assignment", noDisplayNameAssignment, {
  valid: [
    'export const ChartLegend = Object.assign(function ChartLegend() { return null; }, { displayName: "Chart.Legend" });',
    'const meta = { displayName: "Chart" };',
    'part["displayName"] = "Chart";',
  ],
  invalid: [
    {
      code: 'export function ChartLegend() { return null; }\nChartLegend.displayName = "Chart.Legend";',
      errors: [{ messageId: "assignment" }],
    },
  ],
});
