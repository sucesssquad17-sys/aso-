import type {
  CompareExportPayload,
  CompetitorsExportPayload,
  DataExportPayload,
  ExportTimelineRow,
  ExportStoreType,
  GapOpportunityItem,
  MetadataOnlyExportPayload,
  PdfSummaryItem,
  PdfHistoryRange,
  ReportsExportPayload,
  SingleExportPayload,
  TrackedExportPayload,
} from "./dataExportTypes";

type PdfPageOrientation = "landscape" | "portrait";

type PdfSection = {
  columns: Array<{ dataKey: string; header: string }>;
  emptyMessage?: string;
  orientation?: PdfPageOrientation;
  rows: Array<Record<string, number | string>>;
  title: string;
};

type PdfPlan = {
  meta: Array<{ label: string; value: string }>;
  sections: PdfSection[];
  summaryItems: PdfSummaryItem[];
  title: string;
};

type AutoTableFn = (
  doc: unknown,
  options: Record<string, unknown>,
) => void;

type PdfExportSettings = {
  countries?: string[];
  countryLabel?: string;
  historyRange?: PdfHistoryRange;
};

type HistoryBucketMode = "day" | "month" | "week";

type HistoryWindow = {
  bucketMode: HistoryBucketMode;
  end: Date;
  label: string;
  start: Date;
};

export class DataPdfExportError extends Error {
  userMessage: string;

  constructor(message: string, userMessage: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DataPdfExportError";
    this.userMessage = userMessage;
  }
}

export async function exportDataPayloadToPdf(options: {
  filename: string;
  payload: DataExportPayload;
  settings?: PdfExportSettings;
}): Promise<{ openedInNewTab: boolean }> {
  const { filename, payload, settings } = options;
  try {
    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = resolveAutoTable(autoTableModule);
    const plan = buildPdfPlan(payload, settings);
    const doc = new jsPDF({
      compress: true,
      format: "a4",
      orientation: "portrait",
      unit: "pt",
    });

    renderPdfPlan(doc, autoTable, plan);

    decoratePages(doc, plan.title);

    const openedInNewTab = isProbablyMobileDevice();
    downloadPdfBlob(doc.output("blob"), filename, openedInNewTab);
    return { openedInNewTab };
  } catch (error) {
    throw new DataPdfExportError(
      error instanceof Error ? error.message : "Unknown PDF export failure.",
      "Failed to export PDF. Please try again.",
      { cause: error instanceof Error ? error : undefined },
    );
  }
}

function resolveAutoTable(module: Record<string, unknown>) {
  const candidate =
    module.autoTable ?? module.default ?? (module as { default?: { default?: AutoTableFn } }).default?.default;
  if (typeof candidate !== "function") {
    throw new Error("jspdf-autotable exporter is unavailable.");
  }
  return candidate as AutoTableFn;
}

export function buildPdfPlan(
  payload: DataExportPayload,
  settings?: PdfExportSettings,
): PdfPlan {
  const scopedPayload = applyPdfExportSettings(payload, settings);
  const meta = [
    { label: "View", value: scopedPayload.viewMode.toUpperCase() },
    { label: "Store", value: scopedPayload.store === "ios" ? "iOS" : "Google Play" },
    {
      label: "Country",
      value:
        settings?.countryLabel ||
        `${scopedPayload.countryName} (${scopedPayload.country.toUpperCase()})`,
    },
    {
      label: "Timeline",
      value: formatHistoryRangeLabel(settings?.historyRange || "30d"),
    },
    { label: "Exported", value: formatDateTime(scopedPayload.exportedAt) },
  ];

  if (scopedPayload.viewMode === "single" && "app" in scopedPayload) {
    return buildSinglePlan(scopedPayload, meta, settings);
  }
  if (scopedPayload.viewMode === "compare" && "comparedApps" in scopedPayload) {
    return buildComparePlan(scopedPayload, meta);
  }
  if (scopedPayload.viewMode === "tracked" && "groups" in scopedPayload) {
    return buildTrackedPlan(scopedPayload, meta, settings);
  }
  if (scopedPayload.viewMode === "competitors" && "appRoster" in scopedPayload) {
    return buildCompetitorsPlan(scopedPayload, meta, settings);
  }
  if (scopedPayload.viewMode === "reports" && "report" in scopedPayload) {
    return buildReportsPlan(scopedPayload, meta, settings);
  }
  return buildMetadataPlan(scopedPayload, meta);
}

function buildSinglePlan(
  payload: SingleExportPayload,
  meta: Array<{ label: string; value: string }>,
  settings?: PdfExportSettings,
): PdfPlan {
  const historyRows = buildSingleTimelineRows(payload);
  const summaryItems: PdfSummaryItem[] = [
    { label: "App", value: payload.app.title, hint: payload.app.developer },
    {
      label: "Current Rank",
      value: payload.currentRankCheck
        ? formatRankValue(payload.currentRankCheck.rank)
        : "-",
      hint: payload.currentRankCheck?.keyword || "No live keyword check",
    },
    {
      label: "Tracked Keywords",
      value: payload.trackedKeywords.length,
      hint: "Tracked records in this store and country",
    },
    {
      label: "Discovered Rankings",
      value: payload.discoveredRankings.length,
      hint: "Current discovered ranking rows",
    },
    {
      label: "Suggestions",
      value: payload.keywordSuggestions.length,
      hint: "Keyword opportunities exported",
    },
  ];

  return {
    meta,
    sections: [
      {
        columns: [
          { header: "Field", dataKey: "field" },
          { header: "Value", dataKey: "value" },
        ],
        rows: [
          { field: "Title", value: payload.app.title },
          { field: "Developer", value: payload.app.developer },
          { field: "App ID", value: payload.app.appId },
          { field: "Category", value: normalizeCell(payload.app.category) },
          { field: "Score", value: normalizeCell(payload.app.score) },
          { field: "Installs", value: normalizeCell(payload.app.installs) },
          { field: "Store URL", value: normalizeCell(payload.app.url) },
        ],
        title: "App Metadata",
      },
      {
        columns: [
          { header: "App", dataKey: "appTitle" },
          { header: "Keyword", dataKey: "keyword" },
          { header: "Rank", dataKey: "rank" },
          { header: "Demand", dataKey: "demand" },
          { header: "Volume", dataKey: "volume" },
          { header: "Difficulty", dataKey: "difficulty" },
          { header: "Relevance", dataKey: "relevance" },
          { header: "Confidence", dataKey: "confidence" },
        ],
        emptyMessage: "No current rank check is available.",
        rows: payload.currentRankCheck
          ? [
              {
                appTitle: payload.app.title,
                confidence: normalizeCell(payload.currentRankCheck.confidence),
                demand: normalizeCell(payload.currentRankCheck.demand),
                difficulty: normalizeCell(payload.currentRankCheck.difficulty),
                keyword: payload.currentRankCheck.keyword,
                rank: formatRankValue(payload.currentRankCheck.rank),
                relevance: normalizeCell(payload.currentRankCheck.relevance),
                volume: normalizeCell(payload.currentRankCheck.volume),
              },
            ]
          : [],
        title: "Current Rank Check",
      },
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "Rank", dataKey: "rank" },
          { header: "Demand", dataKey: "demand" },
          { header: "Volume", dataKey: "volume" },
          { header: "Difficulty", dataKey: "difficulty" },
          { header: "Relevance", dataKey: "relevance" },
          { header: "Confidence", dataKey: "confidence" },
        ],
        emptyMessage: "No discovered rankings are available.",
        rows: payload.discoveredRankings.map((entry) => ({
          confidence: normalizeCell(entry.confidence),
          demand: normalizeCell(entry.demand),
          difficulty: normalizeCell(entry.difficulty),
          keyword: entry.keyword,
          rank: formatRankValue(entry.rank),
          relevance: normalizeCell(entry.relevance),
          volume: normalizeCell(entry.volume),
        })),
        title: "Discovered Rankings",
      },
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "Demand", dataKey: "demand" },
          { header: "Volume", dataKey: "volume" },
          { header: "Difficulty", dataKey: "difficulty" },
          { header: "Relevance", dataKey: "relevance" },
          { header: "Confidence", dataKey: "confidence" },
        ],
        emptyMessage: "No keyword suggestions are available.",
        rows: payload.keywordSuggestions.map((entry) => ({
          confidence: normalizeCell(entry.confidence),
          demand: normalizeCell(entry.demand),
          difficulty: normalizeCell(entry.difficulty),
          keyword: entry.keyword,
          relevance: normalizeCell(entry.relevance),
          volume: normalizeCell(entry.volume),
        })),
        title: "Keyword Suggestions",
      },
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "App", dataKey: "appTitle" },
          { header: "Country", dataKey: "country" },
          { header: "Last Rank", dataKey: "lastRank" },
          { header: "Status", dataKey: "status" },
          { header: "Last Checked", dataKey: "lastChecked" },
          { header: "Last Error", dataKey: "lastError" },
        ],
        emptyMessage: "No tracked keywords are available.",
        orientation: "landscape",
        rows: payload.trackedKeywords.map((entry) => ({
          appTitle: entry.appTitle,
          country: entry.country.toUpperCase(),
          keyword: entry.keyword,
          lastChecked: formatDateTime(entry.lastChecked),
          lastError: normalizeCell(entry.lastError),
          lastRank: formatRankValue(entry.lastRank),
          status: entry.lastCheckStatus,
        })),
        title: "Tracked Keywords",
      },
      ...buildHistorySections("Historical Rank Tables", historyRows, settings?.historyRange),
    ],
    summaryItems,
    title: "Single App Export",
  };
}

function buildComparePlan(
  payload: CompareExportPayload,
  meta: Array<{ label: string; value: string }>,
): PdfPlan {
  const summaryItems: PdfSummaryItem[] = [
    {
      label: "Compared Apps",
      value: payload.comparedApps.length,
      hint: `${payload.compareSummary.analyzedApps}/${payload.compareSummary.totalApps} analyzed`,
    },
    {
      label: "Mode",
      value: payload.compareSummary.mode,
      hint: payload.compareKeyword || "No compare keyword selected",
    },
    {
      label: "Contested Terms",
      value: payload.contestedKeywords.length,
      hint: "Keywords where multiple apps rank",
    },
    {
      label: "Gap Opportunities",
      value: payload.gapOpportunities.length,
      hint: "Catch-up opportunities across the compared set",
    },
  ];

  return {
    meta,
    sections: [
      {
        columns: [
          { header: "Title", dataKey: "title" },
          { header: "Developer", dataKey: "developer" },
          { header: "App ID", dataKey: "appId" },
          { header: "Category", dataKey: "category" },
          { header: "Score", dataKey: "score" },
          { header: "URL", dataKey: "url" },
        ],
        emptyMessage: "No compared apps are available.",
        orientation: "landscape",
        rows: payload.comparedApps.map((app) => ({
          appId: app.appId,
          category: normalizeCell(app.category),
          developer: app.developer,
          score: normalizeCell(app.score),
          title: app.title,
          url: normalizeCell(app.url),
        })),
        title: "Compared Apps",
      },
      {
        columns: [
          { header: "App", dataKey: "appTitle" },
          { header: "Rank", dataKey: "rank" },
          { header: "Demand", dataKey: "demand" },
          { header: "Volume", dataKey: "volume" },
          { header: "Difficulty", dataKey: "difficulty" },
          { header: "Relevance", dataKey: "relevance" },
          { header: "Confidence", dataKey: "confidence" },
        ],
        emptyMessage: "No compare keyword rankings are available.",
        rows: payload.compareRankings.map((entry) => ({
          appTitle: entry.appTitle,
          confidence: normalizeCell(entry.confidence),
          demand: normalizeCell(entry.demand),
          difficulty: normalizeCell(entry.difficulty),
          rank: formatRankValue(entry.rank),
          relevance: normalizeCell(entry.relevance),
          volume: normalizeCell(entry.volume),
        })),
        title: "Compare Rankings",
      },
      {
        columns: [
          { header: "App", dataKey: "app" },
          { header: "Top 10", dataKey: "top10" },
          { header: "Top 30", dataKey: "top30" },
          { header: "Top 100", dataKey: "top100" },
          { header: "Average Rank", dataKey: "averageRank" },
          { header: "Strongest Keyword", dataKey: "strongestKeyword" },
          { header: "Best Suggestion", dataKey: "bestSuggestion" },
        ],
        emptyMessage: "No app insights are available.",
        orientation: "landscape",
        rows: payload.appInsights.map((entry) => ({
          app: entry.app.title,
          averageRank:
            entry.averageRank !== null ? entry.averageRank.toFixed(1) : "-",
          bestSuggestion: entry.bestSuggestion?.keyword || "-",
          strongestKeyword: entry.strongestKeyword?.keyword || "-",
          top10: entry.top10,
          top100: entry.top100,
          top30: entry.top30,
        })),
        title: "App Insights",
      },
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "Leader", dataKey: "leader" },
          { header: "Runner Up", dataKey: "runnerUp" },
          { header: "Gap", dataKey: "gap" },
          { header: "Avg Volume", dataKey: "averageVolume" },
          { header: "Avg Difficulty", dataKey: "averageDifficulty" },
          { header: "Ranked Apps", dataKey: "rankedApps" },
        ],
        emptyMessage: "No contested keywords are available.",
        orientation: "landscape",
        rows: payload.contestedKeywords.map((entry) => ({
          averageDifficulty: normalizeCell(entry.averageDifficulty),
          averageVolume: normalizeCell(entry.averageVolume),
          gap: entry.gap,
          keyword: entry.keyword,
          leader:
            entry.leaderApp && entry.leaderRank !== null
              ? `${entry.leaderApp} ${formatRankValue(entry.leaderRank ?? -1)}`
              : normalizeCell(entry.leaderApp),
          rankedApps: entry.rankedApps,
          runnerUp:
            entry.runnerUpApp && entry.runnerUpRank !== null
              ? `${entry.runnerUpApp} ${formatRankValue(entry.runnerUpRank ?? -1)}`
              : normalizeCell(entry.runnerUpApp),
        })),
        title: "Contested Keywords",
      },
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "Leader", dataKey: "leader" },
          { header: "Leader Rank", dataKey: "leaderRank" },
          { header: "Score", dataKey: "score" },
          { header: "Avg Volume", dataKey: "averageVolume" },
          { header: "Avg Difficulty", dataKey: "averageDifficulty" },
          { header: "Whitespace", dataKey: "isWhitespace" },
          { header: "Missing Apps", dataKey: "missingApps" },
        ],
        emptyMessage: "No gap opportunities are available.",
        orientation: "landscape",
        rows: payload.gapOpportunities.map((entry: GapOpportunityItem) => ({
          averageDifficulty: normalizeCell(entry.averageDifficulty),
          averageVolume: normalizeCell(entry.averageVolume),
          isWhitespace: entry.isWhitespace ? "Yes" : "No",
          keyword: entry.keyword,
          leader: normalizeCell(entry.leaderApp),
          leaderRank:
            entry.leaderRank !== null && entry.leaderRank !== undefined
              ? formatRankValue(entry.leaderRank)
              : "-",
          missingApps: entry.missingApps?.join(", ") || "-",
          score: normalizeCell(entry.score),
        })),
        title: "Gap Opportunities",
      },
    ],
    summaryItems,
    title: "Compare Export",
  };
}

function buildTrackedPlan(
  payload: TrackedExportPayload,
  meta: Array<{ label: string; value: string }>,
  settings?: PdfExportSettings,
): PdfPlan {
  const summaryItems: PdfSummaryItem[] = [
    {
      label: "Keyword Groups",
      value: payload.summary.totalGroups,
      hint: `${payload.summary.totalRegions} tracked regions`,
    },
    {
      label: "Ranked",
      value: payload.summary.rankedCount,
      hint: `${payload.summary.top10Count} in top 10`,
    },
    {
      label: "Average Rank",
      value:
        payload.summary.averageRank !== null
          ? payload.summary.averageRank.toFixed(1)
          : "-",
      hint: `${payload.summary.trackedAppCount} active apps`,
    },
  ];

  if (payload.summary.pendingCount > 0) {
    summaryItems.push({
      label: "Pending",
      value: payload.summary.pendingCount,
      hint: "Regions awaiting refresh",
    });
  }

  if (payload.summary.needsAttentionCount > 0) {
    summaryItems.push({
      label: "Errors",
      value: payload.summary.needsAttentionCount,
      hint: "Regions with latest check errors",
    });
  }

  return {
    meta: meta.concat([
      { label: "App Filter", value: payload.filters.app },
      { label: "Country Filter", value: payload.filters.country },
      { label: "Search", value: payload.filters.search || "-" },
      { label: "Sort", value: payload.filters.sortBy },
    ]),
    sections: [
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "App", dataKey: "appTitle" },
          { header: "Store", dataKey: "store" },
          { header: "Markets", dataKey: "marketScope" },
          { header: "Ranked", dataKey: "rankedRegions" },
          { header: "Pending", dataKey: "pendingRegions" },
          { header: "Errors", dataKey: "errorRegions" },
          { header: "Delta", dataKey: "improvement" },
          { header: "Checked", dataKey: "lastChecked" },
        ],
        emptyMessage: "No tracked keyword groups are available.",
        orientation: "landscape",
        rows: payload.groups.map((entry) => ({
          appTitle: entry.appTitle,
          errorRegions: entry.errorRegions,
          improvement: formatSignedNumber(entry.improvement),
          keyword: entry.keyword,
          lastChecked: formatDateTime(entry.lastChecked),
          marketScope: formatCountryScope(entry.countries),
          pendingRegions: entry.pendingRegions,
          rankedRegions: entry.rankedRegions,
          store: entry.store === "ios" ? "iOS" : "Play",
        })),
        title: "Tracked Keyword Groups",
      },
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "App", dataKey: "appTitle" },
          { header: "Country", dataKey: "country" },
          { header: "Last Rank", dataKey: "lastRank" },
          { header: "Status", dataKey: "status" },
          { header: "Start", dataKey: "startRank" },
          { header: "Current", dataKey: "currentRank" },
          { header: "Delta", dataKey: "improvement" },
          { header: "Points", dataKey: "historyPoints" },
          { header: "Checked", dataKey: "lastChecked" },
        ],
        emptyMessage: "No tracked country rows are available.",
        orientation: "landscape",
        rows: payload.regions.map((entry) => ({
          appTitle: entry.appTitle,
          country: entry.country.toUpperCase(),
          currentRank: normalizeRank(entry.currentRank),
          historyPoints: entry.historyPoints,
          improvement: formatSignedNumber(entry.improvement),
          keyword: entry.keyword,
          lastChecked: formatDateTime(entry.lastChecked),
          lastRank: formatRankValue(entry.lastRank),
          startRank: normalizeRank(entry.startRank),
          status: formatStatusLabel(entry.lastCheckStatus),
        })),
        title: "Tracked Region Rows",
      },
      ...buildHistorySections(
        "Tracked Rank Tables",
        payload.regions.map((entry) => ({
          appTitle: entry.appTitle,
          country: entry.country,
          history: entry.history,
          keyword: entry.keyword,
          store: entry.store,
        })),
        settings?.historyRange,
      ),
    ],
    summaryItems,
    title: "Tracked Keywords Export",
  };
}

function buildCompetitorsPlan(
  payload: CompetitorsExportPayload,
  meta: Array<{ label: string; value: string }>,
  settings?: PdfExportSettings,
): PdfPlan {
  const singleGroup = payload.groups.length === 1;
  const summaryItems: PdfSummaryItem[] = [
    {
      label: "Saved Groups",
      value: payload.summary.groupCount,
      hint: `${payload.summary.withSnapshots} with snapshots`,
    },
    {
      label: "Tracked Keywords",
      value: payload.summary.trackedKeywordCount,
      hint: `${payload.summary.rankedPairCount} ranked app/keyword pairs`,
    },
    {
      label: "Snapshots",
      value: payload.summary.snapshotCount,
      hint: "Latest competitor analyses stored",
    },
  ];

  return {
    meta,
    sections: [
      {
        columns: [
          { header: "Group", dataKey: "groupName" },
          { header: "Own App", dataKey: "ownAppTitle" },
          { header: "Competitors", dataKey: "competitors" },
          { header: "Tracked Keywords", dataKey: "trackedKeywordCount" },
          { header: "Ranked Pairs", dataKey: "rankedPairCount" },
          { header: "Snapshot", dataKey: "snapshotLoadedAt" },
          { header: "Keyword Refresh", dataKey: "lastKeywordRefreshAt" },
        ],
        emptyMessage: "No competitor groups are available.",
        orientation: "landscape",
        rows: payload.groups.map((entry) => ({
          competitors: entry.competitorTitles.join(", "),
          groupName: entry.groupName,
          lastKeywordRefreshAt: normalizeCell(formatDateTime(entry.lastKeywordRefreshAt)),
          ownAppTitle: entry.ownAppTitle,
          rankedPairCount: entry.rankedPairCount,
          snapshotLoadedAt: normalizeCell(formatDateTime(entry.snapshotLoadedAt)),
          trackedKeywordCount: entry.trackedKeywordCount,
        })),
        title: "Saved Competitor Groups",
      },
      {
        columns: [
          ...(singleGroup
            ? []
            : [{ header: "Group", dataKey: "groupName" }]),
          { header: "Role", dataKey: "role" },
          { header: "App", dataKey: "title" },
          { header: "App ID", dataKey: "appId" },
        ],
        emptyMessage: "No competitor app roster is available.",
        rows: payload.appRoster.map((entry) => {
          const row: Record<string, string> = {
            appId: entry.appId,
            role: entry.role === "own" ? "Own" : "Competitor",
            title: entry.title,
          };
          if (!singleGroup) {
            row.groupName = entry.groupName;
          }
          return row;
        }),
        title: "Competitor App Roster",
      },
      {
        columns: [
          ...(singleGroup
            ? []
            : [{ header: "Group", dataKey: "groupName" }]),
          { header: "Keyword", dataKey: "keyword" },
          { header: "Store", dataKey: "store" },
          { header: "Country", dataKey: "country" },
          { header: "Tracked Apps", dataKey: "appCount" },
          { header: "Ranked Apps", dataKey: "rankedApps" },
          { header: "Last Checked", dataKey: "lastCheckedAt" },
        ],
        emptyMessage: "No tracked competitor keyword rows are available.",
        orientation: "landscape",
        rows: payload.keywords.map((entry) => {
          const row: Record<string, number | string> = {
            appCount: entry.appCount,
            country: entry.country.toUpperCase(),
            keyword: entry.keyword,
            lastCheckedAt: normalizeCell(formatDateTime(entry.lastCheckedAt)),
            rankedApps: entry.rankedApps,
            store: entry.store === "ios" ? "iOS" : "Play",
          };
          if (!singleGroup) {
            row.groupName = entry.groupName;
          }
          return row;
        }),
        title: "Tracked Competitor Keywords",
      },
      ...buildHistorySections(
        "Competitor Rank Tables",
        payload.historyRows,
        settings?.historyRange,
      ),
    ],
    summaryItems,
    title: "Competitor Groups Export",
  };
}

function buildReportsPlan(
  payload: ReportsExportPayload,
  meta: Array<{ label: string; value: string }>,
  settings?: PdfExportSettings,
): PdfPlan {
  const reportModeLabel =
    payload.report.reportMode === "my"
      ? "My Keyword Reports"
      : "Competitor Group Reports";
  const summaryItems = payload.report.summaryItems;
  const reportMeta = meta.concat([
    { label: "Report Mode", value: reportModeLabel },
    { label: "Period", value: payload.report.period.toUpperCase() },
    { label: "Store Filter", value: payload.report.filters.store },
    { label: "Country Filter", value: payload.report.filters.country.toUpperCase() },
    { label: "App Filter", value: payload.report.filters.app },
    { label: "Keyword Filter", value: payload.report.filters.keyword },
  ]);

  if (payload.report.competitorGroupName) {
    reportMeta.push({
      label: "Competitor Group",
      value: payload.report.competitorGroupName,
    });
  }

  const sections: PdfSection[] = [
    {
      columns: [
        { header: "Metric", dataKey: "label" },
        { header: "Value", dataKey: "value" },
        { header: "Context", dataKey: "hint" },
      ],
      emptyMessage: "No trend summary is available.",
      rows: payload.report.trendSummaryItems.map((item) => ({
        hint: item.hint,
        label: item.label,
        value: String(item.value),
      })),
      title: "Trend Summary",
    },
  ];

  if (payload.report.trackedOverviewItems.length > 0) {
    sections.push({
      columns: [
        { header: "Metric", dataKey: "label" },
        { header: "Value", dataKey: "value" },
        { header: "Context", dataKey: "hint" },
      ],
      rows: payload.report.trackedOverviewItems.map((item) => ({
        hint: item.hint,
        label: item.label,
        value: String(item.value),
      })),
      title: "Tracked Overview",
    });
  }

  sections.push(
    {
      columns: buildReportMovementColumns(),
      emptyMessage: "No mover rows are available.",
      orientation: "landscape",
      rows: payload.report.movement.movers.map(mapReportMovementRow),
      title: "Movement - Movers",
    },
    {
      columns: buildReportMovementColumns(),
      emptyMessage: "No gainer rows are available.",
      orientation: "landscape",
      rows: payload.report.movement.gainers.map(mapReportMovementRow),
      title: "Movement - Gainers",
    },
    {
      columns: buildReportMovementColumns(),
      emptyMessage: "No loser rows are available.",
      orientation: "landscape",
      rows: payload.report.movement.losers.map(mapReportMovementRow),
      title: "Movement - Losers",
    },
  );

  if (payload.report.keywordBattles.length > 0) {
    sections.push({
      columns: [
        { header: "Keyword", dataKey: "keyword" },
        { header: "Ranked Apps", dataKey: "rankedAppsCount" },
        { header: "Current Rankings", dataKey: "rankedApps" },
      ],
      orientation: "landscape",
      rows: payload.report.keywordBattles.map((entry) => ({
        keyword: entry.keyword,
        rankedApps: entry.rankedApps,
        rankedAppsCount: entry.rankedAppsCount,
      })),
      title: "Keyword Battles",
    });
  }

  return {
    meta: reportMeta,
    sections: sections.concat(
      buildHistorySections(
        "Report Rank Tables",
        payload.report.historyRows,
        settings?.historyRange,
      ),
    ),
    summaryItems,
    title: "Reports Export",
  };
}

function buildMetadataPlan(
  payload: MetadataOnlyExportPayload,
  meta: Array<{ label: string; value: string }>,
): PdfPlan {
  return {
    meta,
    sections: [],
    summaryItems: [],
    title: `${payload.viewMode.toUpperCase()} Export`,
  };
}

function buildReportMovementColumns() {
  return [
    { header: "Keyword", dataKey: "keyword" },
    { header: "App", dataKey: "appTitle" },
    { header: "Market", dataKey: "market" },
    { header: "Start", dataKey: "previousRank" },
    { header: "Current", dataKey: "currentRank" },
    { header: "Delta", dataKey: "delta" },
    { header: "Context", dataKey: "historyLabel" },
  ];
}

function buildSingleTimelineRows(payload: SingleExportPayload): ExportTimelineRow[] {
  const rowsByKeyword = new Map<string, ExportTimelineRow>();
  payload.rankHistory.forEach((entry) => {
    const existing = rowsByKeyword.get(entry.keyword);
    const point = {
      rank: entry.rank,
      rankDepth: entry.rankDepth,
      timestamp: entry.timestamp,
    };
    if (existing) {
      existing.history.push(point);
      return;
    }
    rowsByKeyword.set(entry.keyword, {
      appTitle: payload.app.title,
      country: payload.country,
      history: [point],
      keyword: entry.keyword,
      store: payload.store,
    });
  });
  return Array.from(rowsByKeyword.values())
    .map((row) => ({
      ...row,
      history: [...row.history].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}

function buildHistorySections(
  titlePrefix: string,
  rows: ExportTimelineRow[],
  historyRange: PdfHistoryRange = "30d",
): PdfSection[] {
  const normalizedRows = rows
    .map((row) => ({
      ...row,
      history: [...row.history].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    }))
    .filter((row) => row.history.length > 0);
  if (normalizedRows.length === 0) {
    return [];
  }

  const anchor = getLatestHistoryTimestamp(normalizedRows);
  const earliest = getEarliestHistoryTimestamp(normalizedRows);
  const windows = getHistoryWindows(anchor, earliest, historyRange);

  return windows.flatMap((window) => {
    const sectionRows = normalizedRows.flatMap((row) =>
      buildHistorySectionRows(row, window),
    );
    if (sectionRows.length === 0) {
      return [];
    }
    return [
      {
        columns: [
          { header: "Keyword", dataKey: "keyword" },
          { header: "App", dataKey: "appTitle" },
          { header: "Market", dataKey: "market" },
          { header: "Date", dataKey: "bucket" },
          { header: "Start", dataKey: "startRank" },
          { header: "End", dataKey: "endRank" },
          { header: "Best", dataKey: "bestRank" },
          { header: "Worst", dataKey: "worstRank" },
          { header: "Avg", dataKey: "avgRank" },
          { header: "Cov.", dataKey: "coverage" },
        ],
        rows: sectionRows,
        title: `${titlePrefix} - ${window.label}`,
      },
    ];
  });
}

function mapReportMovementRow(entry: ReportsExportPayload["report"]["movement"]["movers"][number]) {
  return {
    appTitle: entry.appTitle,
    currentRank: formatRankValue(entry.currentRank),
    delta: formatSignedNumber(entry.delta),
    historyLabel: `${entry.historyLabel} | ${entry.trendLabel}`,
    keyword: entry.keyword,
    market: `${entry.store === "ios" ? "iOS" : "Play"} ${entry.country.toUpperCase()}`,
    previousRank: formatRankValue(entry.previousRank),
  };
}

function getLatestHistoryTimestamp(rows: ExportTimelineRow[]) {
  const latest = rows
    .flatMap((row) => row.history)
    .reduce((max, point) => {
      const time = new Date(point.timestamp).getTime();
      return Number.isFinite(time) && time > max ? time : max;
    }, Number.MIN_SAFE_INTEGER);
  return Number.isFinite(latest) && latest > Number.MIN_SAFE_INTEGER
    ? new Date(latest)
    : new Date();
}

function getEarliestHistoryTimestamp(rows: ExportTimelineRow[]) {
  const earliest = rows
    .flatMap((row) => row.history)
    .reduce((min, point) => {
      const time = new Date(point.timestamp).getTime();
      return Number.isFinite(time) && time < min ? time : min;
    }, Number.MAX_SAFE_INTEGER);
  return Number.isFinite(earliest) && earliest < Number.MAX_SAFE_INTEGER
    ? new Date(earliest)
    : new Date();
}

function createTrailingDaysWindow(
  anchor: Date,
  totalDays: number,
  label: string,
  bucketMode: HistoryBucketMode,
): HistoryWindow {
  const end = endOfDay(anchor);
  const start = startOfDay(addDays(end, -(totalDays - 1)));
  return { bucketMode, end, label, start };
}

function getHistoryWindows(
  anchor: Date,
  earliest: Date,
  historyRange: PdfHistoryRange,
) {
  if (historyRange === "7d") {
    return [createTrailingDaysWindow(anchor, 7, "Last 7 Days", "day")];
  }
  if (historyRange === "30d") {
    return [createTrailingDaysWindow(anchor, 30, "Last 30 Days", "day")];
  }
  if (historyRange === "90d") {
    return [createTrailingDaysWindow(anchor, 90, "Last 90 Days", "week")];
  }
  if (historyRange === "6m") {
    return createTrailingMonthWindows(anchor, 6, 3, "Last 6 Months", "week");
  }
  if (historyRange === "12m") {
    return createTrailingMonthWindows(anchor, 12, 3, "Last 12 Months", "month");
  }
  return createLifetimeWindows(anchor, earliest);
}

function createTrailingMonthWindows(
  anchor: Date,
  totalMonths: number,
  chunkMonths: number,
  label: string,
  bucketMode: HistoryBucketMode,
) {
  const end = endOfDay(anchor);
  const rangeStart = startOfMonth(addMonths(anchor, -(totalMonths - 1)));
  const windows: HistoryWindow[] = [];
  let chunkStart = new Date(rangeStart);

  while (chunkStart <= end) {
    const chunkEnd = endOfDay(
      minDate(end, endOfMonth(addMonths(chunkStart, chunkMonths - 1))),
    );
    windows.push({
      bucketMode,
      end: chunkEnd,
      label: `${label} (${formatMonthRange(chunkStart, chunkEnd)})`,
      start: startOfDay(chunkStart),
    });
    chunkStart = startOfMonth(addMonths(chunkStart, chunkMonths));
  }

  return windows;
}

function createLifetimeWindows(anchor: Date, earliest: Date) {
  const end = endOfDay(anchor);
  const start = startOfMonth(earliest);
  const windows: HistoryWindow[] = [];
  let chunkStart = new Date(start);

  while (chunkStart <= end) {
    const chunkEnd = endOfDay(minDate(end, endOfMonth(addMonths(chunkStart, 2))));
    windows.push({
      bucketMode: "month",
      end: chunkEnd,
      label: `Lifetime (${formatMonthRange(chunkStart, chunkEnd)})`,
      start: startOfDay(chunkStart),
    });
    chunkStart = startOfMonth(addMonths(chunkStart, 3));
  }

  return windows;
}

function buildHistorySectionRows(row: ExportTimelineRow, window: HistoryWindow) {
  const points = row.history.filter((point) => {
    const time = new Date(point.timestamp).getTime();
    return time >= window.start.getTime() && time <= window.end.getTime();
  });
  if (points.length === 0) {
    return [];
  }

  return bucketHistoryPoints(points, window).map((bucket) => ({
    appTitle: row.appTitle,
    avgRank: bucket.avgRank,
    bestRank: bucket.bestRank,
    bucket: bucket.label,
    coverage: `${bucket.rankedDays}/${bucket.totalDays}`,
    endRank: bucket.endRank,
    keyword: row.keyword,
    market: `${row.store === "ios" ? "iOS" : "Play"} ${row.country.toUpperCase()}`,
    startRank: bucket.startRank,
    worstRank: bucket.worstRank,
  }));
}

function bucketHistoryPoints(
  points: ExportTimelineRow["history"],
  window: HistoryWindow,
) {
  if (window.bucketMode === "day") {
    return points.map((point) =>
      summarizeBucket([point], formatShortDate(point.timestamp)),
    );
  }

  if (window.bucketMode === "week") {
    const byBucket = new Map<number, typeof points>();
    points.forEach((point) => {
      const bucketIndex = Math.floor(
        (startOfDay(new Date(point.timestamp)).getTime() - window.start.getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
      const existing = byBucket.get(bucketIndex) || [];
      existing.push(point);
      byBucket.set(bucketIndex, existing);
    });
    return Array.from(byBucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, bucketPoints]) => {
        const sorted = [...bucketPoints].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        return summarizeBucket(
          sorted,
          `${formatShortDate(sorted[0].timestamp)} - ${formatShortDate(
            sorted[sorted.length - 1].timestamp,
          )}`,
        );
      });
  }

  const byMonth = new Map<string, typeof points>();
  points.forEach((point) => {
    const date = new Date(point.timestamp);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(key) || [];
    existing.push(point);
    byMonth.set(key, existing);
  });
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, bucketPoints]) => summarizeBucket(bucketPoints, formatMonthKey(key)));
}

function summarizeBucket(
  points: ExportTimelineRow["history"],
  label: string,
) {
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const rankedPoints = sorted.filter((point) => point.rank !== -1);
  const comparableRanks = sorted.map((point) =>
    point.rank === -1 ? point.rankDepth + 1 : point.rank,
  );
  const bestComparable = Math.min(...comparableRanks);
  const worstComparable = Math.max(...comparableRanks);
  const rankedAverage =
    rankedPoints.length > 0
      ? rankedPoints.reduce((sum, point) => sum + point.rank, 0) / rankedPoints.length
      : null;

  return {
    avgRank: rankedAverage !== null ? `#${rankedAverage.toFixed(1)}` : "-",
    bestRank: formatComparableRank(bestComparable, sorted),
    endRank: formatRankValue(
      sorted[sorted.length - 1].rank,
      sorted[sorted.length - 1].rankDepth,
    ),
    label,
    rankedDays: rankedPoints.length,
    startRank: formatRankValue(sorted[0].rank, sorted[0].rankDepth),
    totalDays: sorted.length,
    worstRank: formatComparableRank(worstComparable, sorted),
  };
}

function renderPdfPlan(
  doc: {
    addPage: (format?: string, orientation?: PdfPageOrientation) => void;
    getCurrentPageInfo?: () => { pageNumber: number };
    internal: { pageSize: { getHeight: () => number; getWidth: () => number } };
    setDrawColor: (color: string) => void;
    setFillColor: (color: string) => void;
    setFont: (fontName: string, fontStyle?: string) => void;
    setFontSize: (size: number) => void;
    setTextColor: (color: string) => void;
    splitTextToSize: (text: string, maxWidth: number) => string[];
    text: (text: string, x: number, y: number) => void;
    rect: (x: number, y: number, width: number, height: number, style?: string) => void;
  },
  autoTable: AutoTableFn,
  plan: PdfPlan,
) {
  const pageMargin = 34;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const availableTableWidth = pageWidth - pageMargin * 2;
  let currentOrientation: PdfPageOrientation = "portrait";
  let cursorY = drawDocumentHeader(doc, plan, pageMargin, pageWidth);

  if (plan.summaryItems.length > 0) {
    cursorY = renderSummaryCards(doc, plan.summaryItems, cursorY, pageMargin, pageWidth);
  }

  for (const section of plan.sections) {
    const desiredOrientation: PdfPageOrientation = "portrait";
    if (desiredOrientation !== currentOrientation) {
      doc.addPage("a4", desiredOrientation);
      currentOrientation = desiredOrientation;
      cursorY = 54;
    } else if (cursorY + estimateSectionHeight(section) > pageHeight - 52) {
      doc.addPage("a4", currentOrientation);
      cursorY = 54;
    } else {
      cursorY += 14;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor("#0f172a");
    doc.text(section.title, pageMargin, cursorY);
    cursorY += 10;

    const rows = section.rows.length
      ? section.rows
      : [
          Object.fromEntries(
            section.columns.map((column, index) => [
              column.dataKey,
              index === 0 ? section.emptyMessage || "No data available." : "",
            ]),
          ),
        ];

    autoTable(doc, {
      alternateRowStyles: { fillColor: [248, 250, 252] },
      body: rows.map((row) =>
        section.columns.map((column) =>
          formatTableCellValue(column.dataKey, row[column.dataKey]),
        ),
      ),
      columnStyles: buildColumnStyles(section.columns, availableTableWidth),
      head: [section.columns.map((column) => column.header)],
      headStyles: {
        fillColor: [15, 23, 42],
        fontSize: 9,
        halign: "left",
        textColor: [248, 250, 252],
      },
      pageBreak: "auto",
      margin: { left: pageMargin, right: pageMargin },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      startY: cursorY + 8,
      styles: {
        cellPadding: 3,
        font: "helvetica",
        fontSize: 8,
        lineColor: [203, 213, 225],
        lineWidth: 0.4,
        overflow: "linebreak",
        textColor: [15, 23, 42],
        valign: "top",
      },
      tableWidth: availableTableWidth,
      theme: "grid",
    });

    cursorY = getLastAutoTableY(doc) + 2;
  }
}

function drawDocumentHeader(
  doc: {
    internal: { pageSize: { getHeight: () => number; getWidth: () => number } };
    setFillColor: (color: string) => void;
    setFont: (fontName: string, fontStyle?: string) => void;
    setFontSize: (size: number) => void;
    setTextColor: (color: string) => void;
    rect: (x: number, y: number, width: number, height: number, style?: string) => void;
    text: (text: string, x: number, y: number) => void;
  },
  plan: PdfPlan,
  pageMargin: number,
  pageWidth: number,
) {
  doc.setFillColor("#0f172a");
  doc.rect(0, 0, pageWidth, 48, "F");
  doc.setTextColor("#f8fafc");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(plan.title, pageMargin, 30);
  doc.setTextColor("#0f172a");
  doc.setFontSize(9.5);

  const metaColumnWidth = (pageWidth - pageMargin * 2 - 16) / 2;
  let cursorY = 64;
  for (let index = 0; index < plan.meta.length; index += 2) {
    const rowItems = plan.meta.slice(index, index + 2);
    rowItems.forEach((item, columnIndex) => {
      const x = pageMargin + columnIndex * (metaColumnWidth + 16);
      doc.setFont("helvetica", "bold");
      doc.text(`${item.label}:`, x, cursorY);
      doc.setFont("helvetica", "normal");
      doc.text(
        shortenText(item.value, 34),
        x + Math.min(64, metaColumnWidth * 0.28),
        cursorY,
      );
    });
    cursorY += 13;
  }
  return cursorY + 4;
}

function renderSummaryCards(
  doc: {
    rect: (x: number, y: number, width: number, height: number, style?: string) => void;
    setDrawColor: (color: string) => void;
    setFillColor: (color: string) => void;
    setFont: (fontName: string, fontStyle?: string) => void;
    setFontSize: (size: number) => void;
    setTextColor: (color: string) => void;
    splitTextToSize: (text: string, maxWidth: number) => string[];
    text: (text: string | string[], x: number, y: number) => void;
  },
  summaryItems: PdfSummaryItem[],
  startY: number,
  pageMargin: number,
  pageWidth: number,
) {
  const gap = 10;
  const columns = 2;
  const cardWidth = (pageWidth - pageMargin * 2 - gap) / columns;
  const baseHeight = 42;
  let cursorY = startY;

  for (let index = 0; index < summaryItems.length; index += columns) {
    const items = summaryItems.slice(index, index + columns);
    let rowHeight = baseHeight;
    items.forEach((item) => {
      const hintLines = doc.splitTextToSize(item.hint, cardWidth - 16);
      rowHeight = Math.max(rowHeight, 30 + hintLines.length * 9);
    });

    items.forEach((item, columnIndex) => {
      const x = pageMargin + columnIndex * (cardWidth + gap);
      doc.setDrawColor("#cbd5e1");
      doc.setFillColor("#f8fafc");
      doc.rect(x, cursorY, cardWidth, rowHeight, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor("#475569");
      doc.text(item.label.toUpperCase(), x + 8, cursorY + 12);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor("#0f172a");
      doc.text(shortenText(String(item.value), 24), x + 8, cursorY + 26);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor("#64748b");
      doc.text(
        doc.splitTextToSize(item.hint, cardWidth - 16),
        x + 8,
        cursorY + 37,
      );
    });

    cursorY += rowHeight + 8;
  }

  return cursorY;
}

function decoratePages(
  doc: {
    getNumberOfPages: () => number;
    internal: {
      getCurrentPageInfo?: () => { pageNumber: number };
      pageSize: { getHeight: () => number; getWidth: () => number };
    };
    setDrawColor: (color: string) => void;
    setFont: (fontName: string, fontStyle?: string) => void;
    setFontSize: (size: number) => void;
    setPage: (pageNumber: number) => void;
    setTextColor: (color: string) => void;
    text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void;
  },
  title: string,
) {
  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor("#cbd5e1");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#64748b");
    doc.text(title, 40, pageHeight - 18);
    doc.text(`Page ${index} of ${totalPages}`, pageWidth - 40, pageHeight - 18, {
      align: "right",
    });
  }
}

function getLastAutoTableY(doc: unknown) {
  const value = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ?.finalY;
  return typeof value === "number" ? value : 72;
}

function estimateSectionHeight(section: PdfSection) {
  const rowCount = Math.max(section.rows.length, 1);
  return 34 + 26 + rowCount * 18;
}

function buildColumnStyles(
  columns: PdfSection["columns"],
  availableWidth: number,
) {
  const baseStyles = columns.map((column) =>
    normalizeColumnStyle(getColumnStyle(column.dataKey)),
  );
  const autoColumnWidth = 42;
  const minimumAutoWidth = 28;
  const fixedWidth = baseStyles.reduce(
    (sum, style) =>
      sum + (typeof style.cellWidth === "number" ? style.cellWidth : 0),
    0,
  );
  const autoCount = baseStyles.filter((style) => style.cellWidth === "auto").length;
  const estimatedWidth = fixedWidth + autoCount * autoColumnWidth;
  const scale =
    estimatedWidth > availableWidth ? availableWidth / estimatedWidth : 1;

  return Object.fromEntries(
    baseStyles.map((style, index) => {
      if (typeof style.cellWidth === "number") {
        return [
          index,
          {
            ...style,
            cellWidth: Math.max(24, Math.floor(style.cellWidth * scale)),
          },
        ];
      }
      if (style.cellWidth === "auto") {
        return [
          index,
          {
            ...style,
            cellWidth: Math.max(minimumAutoWidth, Math.floor(autoColumnWidth * scale)),
          },
        ];
      }
      return [index, style];
    }),
  );
}

function normalizeColumnStyle(style: Record<string, unknown>) {
  return {
    ...style,
    cellWidth:
      typeof style.cellWidth === "number" || style.cellWidth === "auto"
        ? style.cellWidth
        : "auto",
  };
}

function getColumnStyle(dataKey: string) {
  if (
    [
      "rank",
      "lastRank",
      "currentRank",
      "previousRank",
      "leaderRank",
      "runnerUpRank",
      "startRank",
      "endRank",
      "bestRank",
      "worstRank",
      "avgRank",
      "top10",
      "top30",
      "top100",
      "appCount",
      "rankedAppsCount",
      "rankedRegions",
      "pendingRegions",
      "errorRegions",
      "historyPoints",
      "trackedKeywordCount",
      "rankedPairCount",
      "snapshotCount",
      "score",
      "gap",
      "delta",
      "value",
    ].includes(dataKey)
  ) {
    return { cellWidth: 46, halign: "center" };
  }
  if (["store", "role", "country", "status", "isWhitespace", "coverage"].includes(dataKey)) {
    return { cellWidth: 40, halign: "center" };
  }
  if (["market"].includes(dataKey)) {
    return { cellWidth: 48, halign: "center" };
  }
  if (["lastChecked", "lastCheckedAt", "timestamp", "snapshotLoadedAt", "lastKeywordRefreshAt"].includes(dataKey)) {
    return { cellWidth: 78 };
  }
  if (["keyword", "bestSuggestion", "strongestKeyword"].includes(dataKey)) {
    return { cellWidth: 58 };
  }
  if (["bucket"].includes(dataKey)) {
    return { cellWidth: 58 };
  }
  if (["appId"].includes(dataKey)) {
    return { cellWidth: 90 };
  }
  if (["marketScope"].includes(dataKey)) {
    return { cellWidth: 68 };
  }
  if (["groupName", "group", "competitors", "rankedApps", "missingApps", "url"].includes(dataKey)) {
    return { cellWidth: 128 };
  }
  if (["historyLabel", "trendLabel"].includes(dataKey)) {
    return { cellWidth: 108 };
  }
  if (["title", "appTitle", "ownAppTitle", "leader", "runnerUp"].includes(dataKey)) {
    return { cellWidth: 82 };
  }
  return { cellWidth: "auto" };
}

function normalizeRank(rank: number | null) {
  if (rank === null || rank === undefined) {
    return "-";
  }
  return formatRankValue(rank);
}

function formatTableCellValue(dataKey: string, value: unknown) {
  const normalized = normalizeCell(value);
  if (normalized === "-") {
    return normalized;
  }
  if (typeof normalized !== "string") {
    return normalized;
  }

  if (["groupName", "group"].includes(dataKey)) {
    return shortenText(normalizeGroupLabel(normalized), 44);
  }
  if (["competitors", "rankedApps", "missingApps", "historyLabel", "trendLabel", "url"].includes(dataKey)) {
    return shortenText(normalized, 54);
  }
  if (["title", "appTitle", "ownAppTitle", "leader", "runnerUp"].includes(dataKey)) {
    return shortenText(compactAppLabel(normalized), 18);
  }
  if (["appId"].includes(dataKey)) {
    return shortenText(normalized, 28);
  }
  if (["keyword"].includes(dataKey)) {
    return shortenText(normalized, 20);
  }
  if (["marketScope"].includes(dataKey)) {
    return shortenText(normalized, 18);
  }
  return normalized;
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "-";
  }
  return String(value);
}

function normalizeGroupLabel(value: string) {
  const parts = value.split(" vs ").map((part) => shortenText(part.trim(), 20));
  return parts.join(" vs ");
}

function shortenText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function compactAppLabel(value: string) {
  if (value.includes(" ") || !value.includes(".")) {
    return value;
  }
  const segments = value.split(".").filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[segments.length - 2]}.${segments[segments.length - 1]}`;
  }
  return segments[segments.length - 1] || value;
}

function formatCountryScope(countries: string[]) {
  const normalized = Array.from(
    new Set(countries.map((country) => String(country || "").toUpperCase()).filter(Boolean)),
  );
  if (normalized.length === 0) {
    return "-";
  }
  if (normalized.length <= 3) {
    return normalized.join(", ");
  }
  return `${normalized.slice(0, 2).join(", ")} +${normalized.length - 2}`;
}

function formatStatusLabel(value: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  if (!normalized) {
    return "-";
  }
  if (normalized === "ok") {
    return "OK";
  }
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRankValue(rank: number, rankDepth?: number) {
  if (rank === -1) {
    return rankDepth ? `Not top ${rankDepth}` : "Not ranked";
  }
  return `#${rank}`;
}

function formatComparableRank(
  comparableRank: number,
  points: ExportTimelineRow["history"],
) {
  const matchingPoint = points.find((point) =>
    point.rank === -1 ? point.rankDepth + 1 === comparableRank : point.rank === comparableRank,
  );
  if (!matchingPoint) {
    return `#${comparableRank}`;
  }
  return formatRankValue(matchingPoint.rank, matchingPoint.rankDepth);
}

function applyPdfExportSettings(
  payload: DataExportPayload,
  settings?: PdfExportSettings,
): DataExportPayload {
  const countries = settings?.countries?.length
    ? new Set(
        settings.countries.map((country) => String(country || "").trim().toLowerCase()),
      )
    : null;
  if (!countries) {
    return payload;
  }

  if (payload.viewMode === "tracked" && "regions" in payload) {
    const regions = payload.regions.filter((entry) =>
      countries.has(String(entry.country || "").trim().toLowerCase()),
    );
    const groups = payload.groups
      .map((group) => {
        const matchingRegions = regions.filter((entry) => entry.groupId === group.groupId);
        if (matchingRegions.length === 0) {
          return null;
        }
        return {
          ...group,
          countries: group.countries.filter((country) =>
            countries.has(String(country || "").trim().toLowerCase()),
          ),
          errorRegions: matchingRegions.filter((entry) => entry.lastCheckStatus === "error").length,
          pendingRegions: matchingRegions.filter((entry) => entry.lastCheckStatus === "pending").length,
          rankedRegions: matchingRegions.filter((entry) => entry.lastRank !== -1).length,
        };
      })
      .filter((group): group is TrackedExportPayload["groups"][number] => Boolean(group));
    const rankedRegions = regions.filter((entry) => entry.lastRank !== -1);
    return {
      ...payload,
      filters: {
        ...payload.filters,
        country:
          settings?.countryLabel ||
          (countries.size === 1 ? Array.from(countries)[0].toUpperCase() : payload.filters.country),
      },
      groups,
      regions,
      summary: {
        averageRank:
          rankedRegions.length > 0
            ? rankedRegions.reduce((sum, entry) => sum + entry.lastRank, 0) / rankedRegions.length
            : null,
        needsAttentionCount: regions.filter((entry) => entry.lastCheckStatus === "error").length,
        pendingCount: regions.filter((entry) => entry.lastCheckStatus === "pending").length,
        rankedCount: rankedRegions.length,
        top10Count: rankedRegions.filter((entry) => entry.lastRank <= 10).length,
        top3Count: rankedRegions.filter((entry) => entry.lastRank <= 3).length,
        totalGroups: groups.length,
        totalRegions: regions.length,
        trackedAppCount: new Set(regions.map((entry) => `${entry.store}:${entry.appId}`)).size,
      },
    };
  }

  if (payload.viewMode === "competitors" && "historyRows" in payload) {
    return {
      ...payload,
      historyRows: payload.historyRows.filter((entry) =>
        countries.has(String(entry.country || "").trim().toLowerCase()),
      ),
      keywords: payload.keywords.filter((entry) =>
        countries.has(String(entry.country || "").trim().toLowerCase()),
      ),
    };
  }

  if (payload.viewMode === "reports" && "report" in payload) {
    return {
      ...payload,
      report: {
        ...payload.report,
        filters: {
          ...payload.report.filters,
          country:
            settings?.countryLabel && countries.size === 1
              ? settings.countryLabel
              : payload.report.filters.country,
        },
        historyRows: payload.report.historyRows.filter((entry) =>
          countries.has(String(entry.country || "").trim().toLowerCase()),
        ),
        movement: {
          gainers: payload.report.movement.gainers.filter((entry) =>
            countries.has(String(entry.country || "").trim().toLowerCase()),
          ),
          losers: payload.report.movement.losers.filter((entry) =>
            countries.has(String(entry.country || "").trim().toLowerCase()),
          ),
          movers: payload.report.movement.movers.filter((entry) =>
            countries.has(String(entry.country || "").trim().toLowerCase()),
          ),
        },
      },
    };
  }

  return payload;
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function formatHistoryRangeLabel(value: PdfHistoryRange) {
  if (value === "7d") return "Last 7 days";
  if (value === "30d") return "Last 30 days";
  if (value === "90d") return "Last 90 days";
  if (value === "6m") return "Last 6 months";
  if (value === "12m") return "Last 12 months";
  return "Lifetime";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
}

function formatMonthKey(value: string) {
  const [year, month] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatMonthRange(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfMonth(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
}

function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function isProbablyMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function downloadPdfBlob(
  blob: Blob,
  filename: string,
  openInNewTab: boolean,
) {
  const url = URL.createObjectURL(blob);
  const revokeUrl = () => {
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60_000);
  };

  if (openInNewTab) {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (popup) {
      revokeUrl();
      return;
    }
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  revokeUrl();
}
