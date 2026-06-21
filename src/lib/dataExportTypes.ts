export type ExportStoreType = "android" | "ios";
export type ExportViewMode =
  | "single"
  | "compare"
  | "tracked"
  | "competitors"
  | "reports";
export type ExportConfidence = "low" | "medium" | "high";
export type PdfHistoryRange =
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "12m"
  | "lifetime";
export type ReportPdfMode = "my" | "competitors";
export type ReportPdfPeriod = "7d" | "30d" | "90d" | "12m" | "all";

export type PdfSummaryItem = {
  hint: string;
  label: string;
  value: number | string;
};

export type ExportAppMeta = {
  appId: string;
  category?: string | null;
  developer: string;
  icon?: string | null;
  id?: number;
  installs?: number | string | null;
  score?: number | null;
  title: string;
  url?: string | null;
};

export type ExportKeywordMetric = {
  confidence?: ExportConfidence;
  demand?: number | null;
  difficulty?: number | null;
  keyword: string;
  rank: number;
  relevance?: number | null;
  volume?: number | null;
};

export type ExportKeywordSuggestion = {
  confidence?: ExportConfidence;
  demand?: number | null;
  difficulty?: number | null;
  keyword: string;
  relevance?: number | null;
  volume?: number | null;
};

export type ExportTrackedKeywordItem = {
  appId: string;
  appTitle: string;
  country: string;
  groupId?: string;
  keyword: string;
  lastCheckStatus: string;
  lastChecked: string;
  lastError?: string | null;
  lastRank: number;
  store: ExportStoreType;
};

export type ExportHistoryPoint = {
  rank: number;
  rankDepth: number;
  timestamp: string;
};

export type ExportTimelineRow = {
  appTitle: string;
  country: string;
  history: ExportHistoryPoint[];
  keyword: string;
  store: ExportStoreType;
};

export type ExportRankHistoryItem = {
  isSimulated?: boolean;
  keyword: string;
  rank: number;
  rankDepth: number;
  timestamp: string;
};

export type CompareAppInsight = {
  app: ExportAppMeta;
  averageRank: number | null;
  bestSuggestion?: {
    keyword?: string | null;
    rank?: number | null;
  } | null;
  rankings?: ExportKeywordMetric[];
  strongestKeyword?: {
    keyword?: string | null;
    rank?: number | null;
  } | null;
  suggestions?: ExportKeywordSuggestion[];
  top10: number;
  top100: number;
  top30: number;
};

export type CompareRankingItem = {
  appTitle: string;
  confidence?: ExportConfidence;
  demand?: number | null;
  difficulty?: number | null;
  rank: number;
  relevance?: number | null;
  volume?: number | null;
};

export type ContestedKeywordItem = {
  averageDifficulty?: number | null;
  averageRelevance?: number | null;
  averageVolume?: number | null;
  gap: number;
  keyword: string;
  leaderApp?: string | null;
  leaderRank?: number | null;
  rankedApps: string;
  runnerUpApp?: string | null;
  runnerUpRank?: number | null;
};

export type GapOpportunityItem = {
  averageDifficulty?: number | null;
  averageRelevance?: number | null;
  averageVolume?: number | null;
  isWhitespace?: boolean;
  keyword: string;
  leaderApp?: string | null;
  leaderRank?: number | null;
  missingApps?: string[];
  score?: number | null;
};

export type TrackedSummary = {
  averageRank: number | null;
  needsAttentionCount: number;
  pendingCount: number;
  rankedCount: number;
  top10Count: number;
  top3Count: number;
  totalGroups: number;
  totalRegions: number;
  trackedAppCount: number;
};

export type TrackedGroupItem = {
  appId: string;
  appTitle: string;
  countries: string[];
  errorRegions: number;
  groupId: string;
  improvement: number;
  keyword: string;
  lastChecked: string;
  pendingRegions: number;
  rankedRegions: number;
  store: ExportStoreType;
};

export type TrackedRegionItem = {
  appId: string;
  appTitle: string;
  country: string;
  currentRank: number | null;
  groupId: string;
  history: ExportHistoryPoint[];
  historyPoints: number;
  improvement: number;
  keyword: string;
  lastCheckStatus: string;
  lastChecked: string;
  lastError?: string | null;
  lastRank: number;
  startRank: number | null;
  store: ExportStoreType;
};

export type CompetitorSummary = {
  groupCount: number;
  rankedPairCount: number;
  snapshotCount: number;
  trackedKeywordCount: number;
  withSnapshots: number;
};

export type CompetitorGroupItem = {
  competitorTitles: string[];
  groupId: string;
  groupName: string;
  lastKeywordRefreshAt?: string | null;
  ownAppTitle: string;
  rankedPairCount: number;
  snapshotLoadedAt?: string | null;
  trackedKeywordCount: number;
};

export type CompetitorAppRosterItem = {
  appId: string;
  groupId: string;
  groupName: string;
  role: "competitor" | "own";
  title: string;
};

export type CompetitorKeywordItem = {
  appCount: number;
  country: string;
  groupId: string;
  groupName: string;
  keyword: string;
  lastCheckedAt?: string | null;
  rankedApps: string;
  store: ExportStoreType;
};

export type ReportMovementItem = {
  appTitle: string;
  country: string;
  currentDisplayRank: number;
  currentRank: number;
  delta: number;
  historyLabel: string;
  keyword: string;
  previousDisplayRank: number;
  previousRank: number;
  store: ExportStoreType;
  trendLabel: string;
};

export type ReportKeywordBattleItem = {
  keyword: string;
  rankedApps: string;
  rankedAppsCount: number;
};

export type ReportsPdfSnapshot = {
  competitorGroupName?: string | null;
  filters: {
    app: string;
    country: string;
    keyword: string;
    store: ExportStoreType | "all";
  };
  historyRows: ExportTimelineRow[];
  keywordBattles: ReportKeywordBattleItem[];
  movement: {
    gainers: ReportMovementItem[];
    losers: ReportMovementItem[];
    movers: ReportMovementItem[];
  };
  period: ReportPdfPeriod;
  reportMode: ReportPdfMode;
  summaryItems: PdfSummaryItem[];
  trackedOverviewItems: PdfSummaryItem[];
  trendSummaryItems: PdfSummaryItem[];
};

export type BaseExportPayload = {
  country: string;
  countryName: string;
  exportedAt: string;
  store: ExportStoreType;
  viewMode: ExportViewMode;
};

export type SingleExportPayload = BaseExportPayload & {
  app: ExportAppMeta;
  currentRankCheck: ExportKeywordMetric | null;
  discoveredRankings: ExportKeywordMetric[];
  keywordSuggestions: ExportKeywordSuggestion[];
  rankHistory: ExportRankHistoryItem[];
  trackedKeywords: ExportTrackedKeywordItem[];
  viewMode: "single";
};

export type CompareExportPayload = BaseExportPayload & {
  appInsights: CompareAppInsight[];
  compareKeyword: string;
  compareRankings: CompareRankingItem[];
  compareSummary: {
    analyzedApps: number;
    mode: string;
    totalApps: number;
  };
  comparedApps: ExportAppMeta[];
  contestedKeywords: ContestedKeywordItem[];
  gapOpportunities: GapOpportunityItem[];
  viewMode: "compare";
};

export type TrackedExportPayload = BaseExportPayload & {
  filters: {
    app: string;
    country: string;
    search: string;
    sortBy: string;
  };
  groups: TrackedGroupItem[];
  regions: TrackedRegionItem[];
  summary: TrackedSummary;
  viewMode: "tracked";
};

export type CompetitorsExportPayload = BaseExportPayload & {
  appRoster: CompetitorAppRosterItem[];
  groups: CompetitorGroupItem[];
  historyRows: ExportTimelineRow[];
  keywords: CompetitorKeywordItem[];
  summary: CompetitorSummary;
  viewMode: "competitors";
};

export type ReportsExportPayload = BaseExportPayload & {
  report: ReportsPdfSnapshot;
  viewMode: "reports";
};

export type MetadataOnlyExportPayload = BaseExportPayload;

export type DataExportPayload =
  | CompareExportPayload
  | CompetitorsExportPayload
  | MetadataOnlyExportPayload
  | ReportsExportPayload
  | SingleExportPayload
  | TrackedExportPayload;
