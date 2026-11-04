"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { ChartBar, Download, List } from "@elmeragroup/fuse/icons";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Table } from "@elmeragroup/fuse/table";
import { LocaleProvider } from "@elmeragroup/fuse/theme";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

// Invented values. One business's weekly consumption in kWh against the week's mean temperature
// in °C, this year and last, and the normal consumption the app fitted to last year's weeks.
const thisYear = [
  [-0.8, 146_400],
  [-0.5, 142_100],
  [1.1, 139_200],
  [1.2, 137_900],
  [1.2, 129_000],
  [1.7, 133_700],
  [1.7, 131_700],
  [1.8, 137_700],
  [2.7, 130_700],
  [3.3, 88_000],
  [3.6, 137_700],
  [3.6, 121_000],
  [5.2, 127_700],
  [6.6, 109_900],
  [7.5, 100_700],
  [7.6, 115_300],
  [8.2, 101_900],
  [8.4, 89_500],
  [8.9, 98_200],
  [9.3, 95_200],
  [9.4, 98_000],
  [9.5, 100_000],
  [9.7, 99_500],
  [9.9, 84_600],
  [10.1, 95_000],
  [10.9, 87_800],
  [11, 92_800],
  [11.1, 78_900],
  [11.6, 42_400],
  [11.6, 41_600],
  [11.7, 97_700],
  [12.3, 75_600],
  [12.6, 84_100],
  [12.8, 75_400],
  [13.2, 71_900],
  [13.4, 75_900],
  [13.8, 75_600],
  [13.9, 73_600],
  [15.1, 73_900],
  [15.1, 67_900],
  [15.2, 36_400],
  [15.5, 73_600],
  [16.5, 64_000],
  [17, 36_400],
] as const;

const lastYear = [
  [-1, 152_800],
  [-0.8, 102_900],
  [0, 147_300],
  [0.2, 151_300],
  [0.8, 147_600],
  [1, 145_600],
  [1, 138_400],
  [1.3, 141_900],
  [1.3, 103_400],
  [1.4, 143_600],
  [1.7, 143_600],
  [3, 148_600],
  [3.3, 131_700],
  [3.3, 127_500],
  [3.7, 133_200],
  [3.8, 130_500],
  [4.9, 122_300],
  [5, 134_700],
  [5, 118_800],
  [5.3, 117_600],
  [5.6, 123_800],
  [5.7, 132_000],
  [5.8, 124_300],
  [5.8, 115_100],
  [6.9, 114_100],
  [7.2, 121_300],
  [7.9, 104_400],
  [8.1, 109_100],
  [8.3, 104_200],
  [9, 108_900],
  [9.8, 96_500],
  [10.2, 101_700],
  [11, 94_500],
  [12, 80_100],
  [12.2, 88_300],
  [12.4, 42_400],
  [12.9, 78_400],
  [13, 87_600],
  [13.2, 93_000],
  [13.2, 80_800],
  [13.2, 45_100],
  [13.4, 84_600],
  [13.6, 83_100],
  [14, 84_300],
  [14, 80_100],
  [14.1, 77_400],
  [15.5, 76_400],
  [15.5, 71_900],
  [16, 37_700],
  [16.5, 75_400],
  [17.4, 37_200],
] as const;

// The fitted line's two ends. Fuse fits nothing: the app passes the line as its own series.
const normal = [
  [-1, 152_000],
  [17.4, 58_000],
] as const;

const rows = [
  ...thisYear.map(([tempC, kwh]) => ({ tempC, kwh, series: "thisYear" as const })),
  ...lastYear.map(([tempC, kwh]) => ({ tempC, kwh, series: "lastYear" as const })),
  ...normal.map(([tempC, kwh]) => ({ tempC, kwh, series: "normal" as const })),
];

// Keys that read as integers, such as "2026", would list in numeric order, so the keys are names.
// Last year's pale dots take the normal line's role, as a pale tint of it.
const config = {
  thisYear: { label: "Forbruk 2026", color: "chart-1" },
  lastYear: { label: "Forbruk 2025 (referanse)", color: "chart-2" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

const temperature = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const energy = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

/** The rows as a semicolon-separated file with comma decimals, which Excel opens in Norway. */
function download(): void {
  const lines = [
    "Serie;Ukemiddeltemperatur (°C);kWh per uke",
    ...rows.map(({ series, tempC, kwh }) =>
      [config[series].label, String(tempC).replace(".", ","), String(kwh)].join(";")
    ),
  ];
  const url = URL.createObjectURL(new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "energisignatur.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ScatterChartSignature() {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <LocaleProvider locale="nb-NO">
      <Card.Root className="w-full">
        <Card.Content className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup.Root
              aria-label="Visning"
              value={[view]}
              onValueChange={(value: string[]) => {
                if (value[0] === "chart" || value[0] === "table") setView(value[0]);
              }}>
              <ToggleGroup.Item value="chart">
                <ChartBar aria-hidden="true" />
                Diagram
              </ToggleGroup.Item>
              <ToggleGroup.Item value="table">
                <List aria-hidden="true" />
                Tabell
              </ToggleGroup.Item>
            </ToggleGroup.Root>
            <Button variant="outline" onClick={download}>
              <Download aria-hidden="true" />
              Last ned Excel
            </Button>
          </div>
          {view === "chart" ? (
            <ScatterChart.Root
              data={rows}
              config={config}
              xKey="tempC"
              yKey="kwh"
              seriesKey="series"
              xFormat={{ style: "unit", unit: "celsius", maximumFractionDigits: 1 }}
              valueFormat={{ preset: "energy", unit: "kWh", maximumFractionDigits: 0 }}
              xLabel="Ukemiddeltemperatur"
              yLabel="Ukeforbruk"
              aria-label="Ukeforbruk mot ukemiddeltemperatur, 2026 og 2025"
              style={{ "--chart-plot-height": "18rem" }}>
              <ScatterChart.Grid />
              <ScatterChart.XAxis label="Ukemiddeltemperatur (°C)" format={{ maximumFractionDigits: 0 }} />
              <ScatterChart.YAxis label="kWh per uke" format={{ maximumFractionDigits: 0 }} />
              <ScatterChart.Points dataKey="lastYear" size="sm" variant="quiet" />
              <ScatterChart.Line dataKey="normal" />
              <ScatterChart.Points dataKey="thisYear" size="md" />
              <ScatterChart.ActiveDot />
              <ScatterChart.Tooltip />
              <ScatterChart.Legend className="justify-start" />
            </ScatterChart.Root>
          ) : (
            <ScrollArea.Root className="max-h-96 rounded-md border">
              <Table.Root>
                <Table.Caption>Ukeforbruk mot ukemiddeltemperatur, 2026 og 2025</Table.Caption>
                <Table.Header>
                  <Table.Row>
                    <Table.Head scope="col">Serie</Table.Head>
                    <Table.Head scope="col">Ukemiddeltemperatur (°C)</Table.Head>
                    <Table.Head scope="col">kWh per uke</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows
                    .toSorted((a, b) => a.tempC - b.tempC || a.kwh - b.kwh)
                    .map(({ series, tempC, kwh }) => (
                      <Table.Row key={`${series} ${String(tempC)} ${String(kwh)}`}>
                        <Table.Head scope="row">{config[series].label}</Table.Head>
                        <Table.Cell>{temperature.format(tempC)}</Table.Cell>
                        <Table.Cell>{energy.format(kwh)}</Table.Cell>
                      </Table.Row>
                    ))}
                </Table.Body>
              </Table.Root>
            </ScrollArea.Root>
          )}
        </Card.Content>
      </Card.Root>
    </LocaleProvider>
  );
}
