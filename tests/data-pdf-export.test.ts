import assert from "node:assert/strict";
import test from "node:test";

import type { CompareExportPayload, SingleExportPayload } from "../src/lib/dataExportTypes";
import { buildPdfPlan } from "../src/lib/dataPdfExport";

function assertEveryColumnHasRowData(payload: SingleExportPayload | CompareExportPayload) {
  const plan = buildPdfPlan(payload);
  for (const section of plan.sections) {
    for (const row of section.rows) {
      for (const column of section.columns) {
        assert.ok(
          Object.hasOwn(row, column.dataKey),
          `${section.title} row is missing dataKey ${column.dataKey}`,
        );
      }
    }
  }
  return plan;
}

const base = {
  country: "us",
  countryName: "United States",
  exportedAt: "2026-07-22T12:00:00.000Z",
  store: "android" as const,
};

test("single-app PDF discovered ranking columns match row keys", () => {
  const payload: SingleExportPayload = {
    ...base,
    viewMode: "single",
    app: { appId: "com.example.app", developer: "Example", title: "Example App" },
    currentRankCheck: null,
    discoveredRankings: [{ keyword: "habit tracker", rank: 4, volume: 80 }],
    keywordSuggestions: [],
    rankHistory: [],
    trackedKeywords: [],
  };

  const plan = assertEveryColumnHasRowData(payload);
  const section = plan.sections.find((candidate) => candidate.title === "Discovered Rankings");
  assert.equal(section?.columns[0]?.dataKey, "keyword");
  assert.equal(section?.rows[0]?.keyword, "habit tracker");
});

test("comparison PDF ranking columns match app-title row keys", () => {
  const app = { appId: "com.example.app", developer: "Example", title: "Example App" };
  const payload: CompareExportPayload = {
    ...base,
    viewMode: "compare",
    appInsights: [],
    compareKeyword: "habit tracker",
    compareRankings: [{ appTitle: app.title, rank: 6, relevance: 90 }],
    compareSummary: { analyzedApps: 1, mode: "fast", totalApps: 1 },
    comparedApps: [app],
    contestedKeywords: [],
    gapOpportunities: [],
  };

  const plan = assertEveryColumnHasRowData(payload);
  const section = plan.sections.find((candidate) => candidate.title === "Compare Rankings");
  assert.equal(section?.columns[0]?.dataKey, "appTitle");
  assert.equal(section?.rows[0]?.appTitle, "Example App");
});
