import { ruleTester } from "../rule-tester.ts";
import { chartDemoTable } from "./chart-demo-table.ts";

ruleTester.run("chart-demo-table", chartDemoTable, {
  valid: [
    'export const Demo = () => (\n  <Chart.Root data={rows}>\n    <Chart.Bar dataKey="kwh" />\n    <Chart.Table />\n  </Chart.Root>\n);',
    "export const Demo = () => (\n  <BarChart.Root data={rows}>\n    <BarChart.Table />\n  </BarChart.Root>\n);",
    // A demo that mounts no chart Root, such as a skeleton or a legend on its own.
    "export const Demo = () => <Chart.Skeleton />;",
  ],
  invalid: [
    {
      code: 'export const Demo = () => (\n  <Chart.Root data={rows}>\n    <Chart.Bar dataKey="kwh" />\n  </Chart.Root>\n);',
      errors: [{ messageId: "missing", data: { family: "Chart" } }],
    },
    // Another family's Table does not stand in for this one's.
    {
      code: "export const Demo = () => (\n  <>\n    <BarChart.Root data={rows} />\n    <Chart.Table />\n  </>\n);",
      errors: [{ messageId: "missing", data: { family: "BarChart" } }],
    },
  ],
});
