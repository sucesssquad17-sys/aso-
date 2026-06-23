import React from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Globe,
  LineChart,
  Swords,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart as RechartsLineChart,
} from "recharts";
import RankSparkline from "../../components/RankSparkline";

// Stable component defined outside render to avoid recharts infinite loop
function PieDonutLabel({
  viewBox,
  value,
}: {
  viewBox?: unknown;
  value?: unknown;
}) {
  const candidateViewBox =
    viewBox && typeof viewBox === "object"
      ? (viewBox as { cx?: number; cy?: number })
      : null;
  if (
    !candidateViewBox ||
    candidateViewBox.cx === undefined ||
    candidateViewBox.cy === undefined
  ) {
    return null;
  }
  return (
    <text
      x={candidateViewBox.cx}
      y={candidateViewBox.cy}
      textAnchor="middle"
      dominantBaseline="central"
    >
      <tspan
        x={candidateViewBox.cx}
        y={candidateViewBox.cy}
        fill="white"
        fontSize={24}
        fontWeight={700}
      >
        {typeof value === "string" || typeof value === "number" ? value : ""}
      </tspan>
    </text>
  );
}
import {
  COUNTRY_OPTIONS as COUNTRIES,
  findCountryName,
} from "../../lib/countries";
import type {
  PdfSummaryItem,
  ReportsPdfSnapshot,
} from "../../lib/dataExportTypes";
import {
  buildTrackedAppChartHistory,
  buildTrackedKeywordChartHistory,
  getTrackedKeywordKey,
  type ChartRankHistoryEntry,
  type CompetitorAsoDiffRecord,
  type CompetitorAsoSnapshotRecord,
  type CompetitorGroupRecord,
  type CompetitorKeywordChartPoint,
  type CompetitorTrackedKeywordRecord,
  type StoreType,
  type TrackedKeyword,
} from "../tracking/model";
import { CountrySearchSelect } from "../tracking/components";
import {
  WorkspaceEmptyBlock,
  WorkspacePanel,
} from "../app/workspacePrimitives";

type ReportMode = "my" | "competitors";
type ReportPeriodKey = "7d" | "30d" | "90d" | "12m" | "all";
type MovementTabKey = "movers" | "gainers" | "losers";

function formatReportDateTime(timestamp: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

type ReportMovementEntry = {
  id: string;
  keyword: string;
  appTitle: string;
  appId: string;
  store: StoreType;
  country: string;
  previousRank: number;
  currentRank: number;
  previousDisplayRank: number;
  currentDisplayRank: number;
  delta: number;
  absoluteDelta: number;
  history: ChartRankHistoryEntry[];
  historyLabel: string;
  trendLabel: string;
  appKey?: string;
};

type MyReportSummary = {
  rankedKeywords: number;
  regionsMonitored: number;
  averageRank: number | null;
  top10Count: number;
  top3Count: number;
};

type CompetitorReportSummary = {
  trackedTerms: number;
  rankedPairs: number;
  averageRank: number | null;
  top10Count: number;
  top3Count: number;
};

type MyTrendPoint = {
  dayKey: string;
  timestamp: string;
  fullTime: string;
  averageRank: number;
  rankedCount: number;
};

type CompetitorLineMeta = {
  appKey: string;
  title: string;
  color: string;
};

type MyCompactSummary = {
  averageRank: number | null;
  top10Count: number;
  top3Count: number;
  biggestGain: ReportMovementEntry | null;
  biggestLoss: ReportMovementEntry | null;
};

type CompetitorComparisonSummary = {
  winnerTitle: string | null;
  winnerAverageRank: number | null;
  overlapCount: number;
  bestOpportunity:
    | {
        keyword: string;
        gap: number;
        competitorTitle: string;
      }
    | null;
  worstLoss:
    | {
        keyword: string;
        gap: number;
        competitorTitle: string;
      }
    | null;
};

type ReportTrackedCountryRow = {
  appId: string;
  appTitle: string;
  country: string;
  groupId?: string;
  history: ChartRankHistoryEntry[];
  keyword: string;
  lastChecked: string;
  lastCheckStatus: TrackedKeyword["lastCheckStatus"];
  store: StoreType;
};

type TrackedReportOverview = {
  lastRefreshLabel: string;
  keywordGroups: number;
  rankedKeywords: number;
  top10Count: number;
  top3Count: number;
  trackedAppCount: number;
  averageRank: number | null;
  range4To10Count: number;
  range11To50Count: number;
};

const REPORT_PERIOD_OPTIONS: Array<{ key: ReportPeriodKey; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "12m", label: "12M" },
  { key: "all", label: "All time" },
];

const REPORT_MODE_OPTIONS: Array<{ key: ReportMode; label: string }> = [
  { key: "my", label: "My Keyword Reports" },
  { key: "competitors", label: "Competitor Group Reports" },
];

const REPORT_LINE_COLORS = ["#67e8f9", "#34d399", "#f59e0b", "#a78bfa", "#fb7185"];

function getPeriodStart(period: ReportPeriodKey, now = new Date()) {
  if (period === "all") return null;
  const start = new Date(now);
  if (period === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (period === "90d") {
    start.setDate(start.getDate() - 89);
  } else {
    start.setMonth(start.getMonth() - 12);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

function filterHistoryByPeriod(
  history: ChartRankHistoryEntry[],
  period: ReportPeriodKey,
) {
  const periodStart = getPeriodStart(period);
  if (!periodStart) return history;
  return history.filter(
    (entry) => new Date(entry.rawTimestamp).getTime() >= periodStart.getTime(),
  );
}

function getComparableRank(point: ChartRankHistoryEntry) {
  return point.rawRank === -1 ? point.rankDepth + 1 : point.rawRank;
}

function formatRankLabel(rank: number, rankDepth: number) {
  return rank === -1 ? `Not top ${rankDepth}` : `#${rank}`;
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "0";
}

function getChangeTone(delta: number) {
  if (delta > 0) return "text-cyan-300 bg-cyan-500/12 border-cyan-500/20";
  if (delta < 0) return "text-rose-300 bg-rose-500/12 border-rose-500/20";
  return "text-app-text-muted bg-app-surface-muted/80 border-app-border/70";
}

function getRankTone(rank: number) {
  if (rank === -1) return "text-rose-300";
  if (rank <= 3) return "text-cyan-300";
  if (rank <= 10) return "text-cyan-300";
  return "text-app-text";
}

function getYAxisDomainFromSeries(values: number[]) {
  if (values.length === 0) {
    return [0, 1] as [number, number];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [Math.max(1, Math.floor(min - 2)), Math.ceil(max + 2)] as [
    number,
    number,
  ];
}

function buildMovementEntry({
  id,
  keyword,
  appTitle,
  appId,
  store,
  country,
  history,
  historyLabel,
  appKey,
}: {
  id: string;
  keyword: string;
  appTitle: string;
  appId: string;
  store: StoreType;
  country: string;
  history: ChartRankHistoryEntry[];
  historyLabel: string;
  appKey?: string;
}): ReportMovementEntry | null {
  if (history.length < 2) return null;
  const previous = history[0];
  const current = history[history.length - 1];
  const previousDisplayRank = getComparableRank(previous);
  const currentDisplayRank = getComparableRank(current);
  const delta = previousDisplayRank - currentDisplayRank;
  return {
    id,
    keyword,
    appTitle,
    appId,
    store,
    country,
    previousRank: previous.rawRank,
    currentRank: current.rawRank,
    previousDisplayRank,
    currentDisplayRank,
    delta,
    absoluteDelta: Math.abs(delta),
    history,
    historyLabel,
    trendLabel: `${formatRankLabel(previous.rawRank, previous.rankDepth)} -> ${formatRankLabel(current.rawRank, current.rankDepth)}`,
    appKey,
  };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    name?: string | number;
    value?: unknown;
  }>;
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-app-border/70 bg-app-surface/95 px-3 py-2 text-xs text-app-text shadow-2xl">
      <p className="font-semibold text-app-text">
        {typeof label === "string" || typeof label === "number" ? label : ""}
      </p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div
            key={`${entry.name}-${entry.value}`}
            className="flex items-center justify-between gap-3"
          >
            <span
              className="inline-flex items-center gap-2 text-app-text-muted"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || "#94a3b8" }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-app-text">
              {typeof entry.value === "number" ? `#${entry.value.toFixed(1)}` : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <WorkspacePanel tone="muted">
      <div className="mb-3 flex items-start gap-2.5 sm:mb-4 sm:gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border/70 bg-app-surface-muted/80 sm:h-10 sm:w-10 sm:rounded-2xl">
          <Icon className="h-4 w-4 text-cyan-300" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-app-text sm:text-lg">{title}</h3>
          <p className="mt-1 text-xs text-app-text-muted sm:text-sm">{description}</p>
        </div>
      </div>
      {children}
    </WorkspacePanel>
  );
}

function CompactStatGrid({
  items,
  columnsClassName = "xl:grid-cols-5",
}: {
  items: Array<{
    label: string;
    value: string | number;
    hint: string;
  }>;
  columnsClassName?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 ${columnsClassName}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col rounded-xl border border-app-border/60 bg-app-surface/40 p-3 sm:rounded-2xl sm:p-4"
        >
          <div className="workspace-chip-label !text-[10px] sm:!text-[11px] mb-1">
            {item.label}
          </div>
          <div className="text-xl font-bold text-app-text font-display sm:text-2xl">
            {item.value}
          </div>
          <div className="mt-auto hidden pt-1.5 text-[10px] leading-tight text-app-text-muted sm:block sm:pt-2 sm:text-xs">
            {item.hint}
          </div>
        </div>
      ))}
    </div>
  );
}

function MovementRowsList({
  rows,
  onSelectKeyword,
}: {
  rows: ReportMovementEntry[];
  onSelectKeyword: (keyword: string) => void;
}) {
  return (
    <>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border/70 bg-app-surface/35 px-4 py-6 text-sm text-app-text-muted">
          No movement rows available for this selection.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectKeyword(row.keyword)}
              className="w-full overflow-hidden rounded-xl border border-app-border/70 bg-app-surface/45 px-3 py-3 text-left transition-colors hover:border-cyan-500/30 hover:bg-app-surface-muted/70 sm:rounded-2xl sm:px-4 sm:py-4"
            >
              <div className="flex flex-col gap-2.5 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-app-text">
                      {row.keyword}
                    </span>
                    <span className="rounded-full border border-app-border/70 bg-app-surface-muted/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-app-text-muted">
                      {row.store === "ios" ? "iOS" : "Play"}
                    </span>
                    <span className="rounded-full border border-app-border/70 bg-app-surface-muted/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-app-text-muted">
                      {row.country.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-app-text-muted sm:text-sm">
                    {row.historyLabel}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getChangeTone(row.delta)}`}
                  >
                    {formatDelta(row.delta)}
                  </span>
                  <span className="text-xs text-app-text-muted">
                    {row.trendLabel}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_108px_108px_132px] sm:mt-4 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                    App
                  </p>
                  <p className="mt-1 truncate text-sm text-app-text">
                    {row.appTitle}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                    Start
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${getRankTone(row.previousRank)}`}>
                    {formatRankLabel(row.previousRank, row.history[0]?.rankDepth ?? 100)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                    Current
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${getRankTone(row.currentRank)}`}>
                    {formatRankLabel(
                      row.currentRank,
                      row.history[row.history.length - 1]?.rankDepth ?? 100,
                    )}
                  </p>
                </div>
                <div className="h-20 min-w-0">
                  <RankSparkline data={row.history} stroke={row.delta >= 0 ? "#34d399" : "#fb7185"} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function TabbedMovementSection({
  title,
  description,
  selectedTab,
  onChangeTab,
  movers,
  gainers,
  losers,
  onSelectKeyword,
}: {
  title: string;
  description: string;
  selectedTab: MovementTabKey;
  onChangeTab: (tab: MovementTabKey) => void;
  movers: ReportMovementEntry[];
  gainers: ReportMovementEntry[];
  losers: ReportMovementEntry[];
  onSelectKeyword: (keyword: string) => void;
}) {
  const tabConfig: Array<{
    key: MovementTabKey;
    label: string;
    rows: ReportMovementEntry[];
    panelDescription: string;
  }> = [
    {
      key: "movers",
      label: "Movers",
      rows: movers,
      panelDescription: "Biggest absolute movement, regardless of direction.",
    },
    {
      key: "gainers",
      label: "Gainers",
      rows: gainers,
      panelDescription: "Entries with the strongest upward movement.",
    },
    {
      key: "losers",
      label: "Losers",
      rows: losers,
      panelDescription: "Entries losing the most ground in the selected window.",
    },
  ];

  const activeTab =
    tabConfig.find((tab) => tab.key === selectedTab) || tabConfig[0];

  return (
    <WorkspacePanel tone="muted">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="workspace-chip-label">{title}</div>
          <h3 className="mt-1 text-base font-semibold text-app-text sm:text-lg">
            {description}
          </h3>
          <p className="mt-1 hidden text-sm text-app-text-muted sm:block">
            {activeTab.panelDescription}
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-app-border/70 bg-app-surface-muted/60 p-1">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChangeTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                activeTab.key === tab.key
                  ? "bg-cyan-500/15 text-cyan-200"
                  : "text-app-text-muted hover:text-app-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <MovementRowsList
          rows={activeTab.rows}
          onSelectKeyword={onSelectKeyword}
        />
      </div>
    </WorkspacePanel>
  );
}

export default function ReportsWorkspace({
  trackedKeywords,
  trackedHistoryByKey,
  trackedCountryRowsForExport,
  competitorGroups,
  competitorAsoDiffs,
  competitorAsoLatestSnapshots,
  competitorTrackedKeywordsByGroupId,
  competitorRankHistoryByTrackedKeywordId,
  trackedOverview,
  defaultCountry,
  defaultStore,
  onEditCompetitorKeywordCountries,
  onExportSnapshotChange,
}: {
  trackedKeywords: TrackedKeyword[];
  trackedHistoryByKey: Map<string, ChartRankHistoryEntry[]>;
  trackedCountryRowsForExport: ReportTrackedCountryRow[];
  competitorGroups: CompetitorGroupRecord[];
  competitorAsoDiffs: CompetitorAsoDiffRecord[];
  competitorAsoLatestSnapshots: CompetitorAsoSnapshotRecord[];
  competitorTrackedKeywordsByGroupId: Map<string, CompetitorTrackedKeywordRecord[]>;
  competitorRankHistoryByTrackedKeywordId: Map<
    string,
    Map<string, ChartRankHistoryEntry[]>
  >;
  trackedOverview: TrackedReportOverview;
  defaultCountry: string;
  defaultStore: StoreType;
  onEditCompetitorKeywordCountries?: (input: {
    groupId: string;
    keyword: string;
  }) => void;
  onExportSnapshotChange?: (snapshot: ReportsPdfSnapshot) => void;
}) {
  const [reportMode, setReportMode] = React.useState<ReportMode>("my");
  const [period, setPeriod] = React.useState<ReportPeriodKey>("30d");
  const [myMovementTab, setMyMovementTab] =
    React.useState<MovementTabKey>("movers");
  const [competitorMovementTab, setCompetitorMovementTab] =
    React.useState<MovementTabKey>("movers");
  const [isTrackedOverviewOpen, setIsTrackedOverviewOpen] =
    React.useState(false);
  const [reportStoreFilter, setReportStoreFilter] = React.useState<
    StoreType | "all"
  >(defaultStore);
  const [reportCountryFilter, setReportCountryFilter] =
    React.useState<string>(defaultCountry);
  const [reportAppFilter, setReportAppFilter] = React.useState<string>("all");
  const [reportKeywordFilter, setReportKeywordFilter] =
    React.useState<string>("all");
  const [competitorGroupFilter, setCompetitorGroupFilter] =
    React.useState<string>(competitorGroups[0]?.groupId || "");
  const hasKeywordDrilldown = reportKeywordFilter !== "all";

  React.useEffect(() => {
    if (
      competitorGroupFilter &&
      competitorGroups.some((group) => group.groupId === competitorGroupFilter)
    ) {
      return;
    }
    setCompetitorGroupFilter(competitorGroups[0]?.groupId || "");
  }, [competitorGroupFilter, competitorGroups]);

  React.useEffect(() => {
    setReportStoreFilter(defaultStore);
  }, [defaultStore]);

  React.useEffect(() => {
    setReportCountryFilter(defaultCountry);
  }, [defaultCountry]);

  React.useEffect(() => {
    setReportKeywordFilter("all");
  }, [reportMode, reportAppFilter, reportCountryFilter, reportStoreFilter, competitorGroupFilter]);

  const trackedAppOptions = React.useMemo(
    () =>
      Array.from(new Set(trackedKeywords.map((keyword) => keyword.appTitle))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [trackedKeywords],
  );

  const myKeywordOptions = React.useMemo(() => {
    const filtered = trackedKeywords.filter((entry) => {
      if (reportAppFilter !== "all" && entry.appTitle !== reportAppFilter) {
        return false;
      }
      if (reportStoreFilter !== "all" && entry.store !== reportStoreFilter) {
        return false;
      }
      if (reportCountryFilter !== "all" && entry.country !== reportCountryFilter) {
        return false;
      }
      return true;
    });
    return Array.from(new Set(filtered.map((entry) => entry.keyword))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [
    reportAppFilter,
    reportCountryFilter,
    reportStoreFilter,
    trackedKeywords,
  ]);

  const myMovementEntries = React.useMemo(() => {
    return trackedKeywords
      .filter((trackedKeyword) => {
        if (
          reportAppFilter !== "all" &&
          trackedKeyword.appTitle !== reportAppFilter
        ) {
          return false;
        }
        if (
          reportStoreFilter !== "all" &&
          trackedKeyword.store !== reportStoreFilter
        ) {
          return false;
        }
        if (
          reportCountryFilter !== "all" &&
          trackedKeyword.country !== reportCountryFilter
        ) {
          return false;
        }
        if (
          reportKeywordFilter !== "all" &&
          trackedKeyword.keyword !== reportKeywordFilter
        ) {
          return false;
        }
        return true;
      })
      .map((trackedKeyword) => {
        const history =
          trackedHistoryByKey.get(getTrackedKeywordKey(trackedKeyword)) || [];
        const chartHistory = buildTrackedKeywordChartHistory(
          trackedKeyword,
          history,
        );
        const periodHistory = filterHistoryByPeriod(chartHistory, period);
        return buildMovementEntry({
          id: `${trackedKeyword.groupId}:${trackedKeyword.country}`,
          keyword: trackedKeyword.keyword,
          appTitle: trackedKeyword.appTitle,
          appId: trackedKeyword.appId,
          store: trackedKeyword.store,
          country: trackedKeyword.country,
          history: periodHistory,
          historyLabel: `${trackedKeyword.appTitle} in ${findCountryName(trackedKeyword.country) || trackedKeyword.country}`,
        });
      })
      .filter((entry): entry is ReportMovementEntry => Boolean(entry));
  }, [
    period,
    reportAppFilter,
    reportCountryFilter,
    reportKeywordFilter,
    reportStoreFilter,
    trackedHistoryByKey,
    trackedKeywords,
  ]);

  const myReportSummary = React.useMemo<MyReportSummary>(() => {
    const currentRanks = myMovementEntries
      .map((entry) => entry.currentRank)
      .filter((rank) => rank !== -1);
    return {
      rankedKeywords: currentRanks.length,
      regionsMonitored: myMovementEntries.length,
      averageRank:
        currentRanks.length > 0
          ? currentRanks.reduce((sum, rank) => sum + rank, 0) / currentRanks.length
          : null,
      top10Count: currentRanks.filter((rank) => rank <= 10).length,
      top3Count: currentRanks.filter((rank) => rank <= 3).length,
    };
  }, [myMovementEntries]);

  const myTrendData = React.useMemo<MyTrendPoint[]>(() => {
    const byDay = new Map<
      string,
      {
        timestamp: string;
        fullTime: string;
        ranks: number[];
        rankedCount: number;
      }
    >();
    myMovementEntries.forEach((entry) => {
      entry.history.forEach((point) => {
        const current = byDay.get(point.dayKey) || {
          timestamp: point.timestamp,
          fullTime: point.fullTime,
          ranks: [],
          rankedCount: 0,
        };
        current.ranks.push(getComparableRank(point));
        if (point.rawRank !== -1) {
          current.rankedCount += 1;
        }
        byDay.set(point.dayKey, current);
      });
    });
    return Array.from(byDay.entries())
      .map(([dayKey, entry]) => ({
        dayKey,
        timestamp: entry.timestamp,
        fullTime: entry.fullTime,
        averageRank:
          entry.ranks.reduce((sum, rank) => sum + rank, 0) / entry.ranks.length,
        rankedCount: entry.rankedCount,
      }))
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [myMovementEntries]);

  const selectedCompetitorGroup = React.useMemo(
    () =>
      competitorGroups.find((group) => group.groupId === competitorGroupFilter) ||
      null,
    [competitorGroupFilter, competitorGroups],
  );

  const competitorKeywordOptions = React.useMemo(() => {
    if (!selectedCompetitorGroup) return [];
    const records =
      competitorTrackedKeywordsByGroupId.get(selectedCompetitorGroup.groupId) || [];
    return Array.from(new Set(records.map((record) => record.keyword))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [competitorTrackedKeywordsByGroupId, selectedCompetitorGroup]);

  const competitorMovementEntries = React.useMemo(() => {
    if (!selectedCompetitorGroup) return [];
    const records =
      competitorTrackedKeywordsByGroupId.get(selectedCompetitorGroup.groupId) || [];
    return records
      .filter((record) => {
        if (
          reportKeywordFilter !== "all" &&
          record.keyword !== reportKeywordFilter
        ) {
          return false;
        }
        return true;
      })
      .flatMap((record) => {
        const historyByApp =
          competitorRankHistoryByTrackedKeywordId.get(record.trackedKeywordId) ||
          new Map<string, ChartRankHistoryEntry[]>();
        return record.apps
          .map((app) => {
            const chartHistory = buildTrackedAppChartHistory(
              app,
              historyByApp.get(app.appKey) || [],
            );
            const periodHistory = filterHistoryByPeriod(chartHistory, period);
            return buildMovementEntry({
              id: `${record.trackedKeywordId}:${app.appKey}`,
              keyword: record.keyword,
              appTitle: app.title,
              appId: app.appId,
              store: record.store,
              country: record.country,
              history: periodHistory,
              historyLabel: `${record.keyword} • ${app.title}`,
              appKey: app.appKey,
            });
          })
          .filter((entry): entry is ReportMovementEntry => Boolean(entry));
      });
  }, [
    competitorRankHistoryByTrackedKeywordId,
    competitorTrackedKeywordsByGroupId,
    period,
    reportKeywordFilter,
    selectedCompetitorGroup,
  ]);

  const competitorReportSummary = React.useMemo<CompetitorReportSummary>(() => {
    const currentRanks = competitorMovementEntries
      .map((entry) => entry.currentRank)
      .filter((rank) => rank !== -1);
    return {
      trackedTerms: new Set(competitorMovementEntries.map((entry) => entry.keyword))
        .size,
      rankedPairs: currentRanks.length,
      averageRank:
        currentRanks.length > 0
          ? currentRanks.reduce((sum, rank) => sum + rank, 0) / currentRanks.length
          : null,
      top10Count: currentRanks.filter((rank) => rank <= 10).length,
      top3Count: currentRanks.filter((rank) => rank <= 3).length,
    };
  }, [competitorMovementEntries]);

  const competitorTrendMeta = React.useMemo<CompetitorLineMeta[]>(() => {
    if (!selectedCompetitorGroup) return [];
    const apps = [selectedCompetitorGroup.ownApp, ...selectedCompetitorGroup.competitors];
    return apps.map((app, index) => ({
      appKey: app.appKey,
      title: app.title,
      color: REPORT_LINE_COLORS[index % REPORT_LINE_COLORS.length],
    }));
  }, [selectedCompetitorGroup]);

  const competitorTrendData = React.useMemo<CompetitorKeywordChartPoint[]>(() => {
    const byDay = new Map<
      string,
      {
        timestamp: string;
        fullTime: string;
        rawTimestamp: string;
        valuesByApp: Map<string, number[]>;
      }
    >();
    competitorMovementEntries.forEach((entry) => {
      entry.history.forEach((point) => {
        const current = byDay.get(point.dayKey) || {
          timestamp: point.timestamp,
          fullTime: point.fullTime,
          rawTimestamp: point.rawTimestamp,
          valuesByApp: new Map<string, number[]>(),
        };
        const appValues = current.valuesByApp.get(entry.appKey || "") || [];
        appValues.push(getComparableRank(point));
        current.valuesByApp.set(entry.appKey || "", appValues);
        if (
          new Date(point.rawTimestamp).getTime() >
          new Date(current.rawTimestamp).getTime()
        ) {
          current.rawTimestamp = point.rawTimestamp;
          current.fullTime = point.fullTime;
          current.timestamp = point.timestamp;
        }
        byDay.set(point.dayKey, current);
      });
    });
    return Array.from(byDay.entries())
      .map(([dayKey, entry]) => {
        const point: CompetitorKeywordChartPoint = {
          dayKey,
          timestamp: entry.timestamp,
          fullTime: entry.fullTime,
          rawTimestamp: entry.rawTimestamp,
        };
        competitorTrendMeta.forEach((meta) => {
          const values = entry.valuesByApp.get(meta.appKey) || [];
          if (values.length > 0) {
            point[meta.appKey] =
              values.reduce((sum, value) => sum + value, 0) / values.length;
          }
        });
        return point;
      })
      .sort(
        (a, b) =>
          new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
      );
  }, [competitorMovementEntries, competitorTrendMeta]);

  const competitorKeywordBattles = React.useMemo(() => {
    if (!selectedCompetitorGroup) return [];
    const records =
      competitorTrackedKeywordsByGroupId.get(selectedCompetitorGroup.groupId) || [];
    return records
      .filter((record) => {
        if (
          reportKeywordFilter !== "all" &&
          record.keyword !== reportKeywordFilter
        ) {
          return false;
        }
        return record.apps.filter((app) => app.lastRank !== -1).length >= 2;
      })
      .map((record) => ({
        keyword: record.keyword,
        rankedApps: [...record.apps]
          .filter((app) => app.lastRank !== -1)
          .sort((a, b) => a.lastRank - b.lastRank),
      }))
      .sort((a, b) => {
        if (b.rankedApps.length !== a.rankedApps.length) {
          return b.rankedApps.length - a.rankedApps.length;
        }
        return a.rankedApps[0].lastRank - b.rankedApps[0].lastRank;
      })
      .slice(0, 6);
  }, [
    competitorTrackedKeywordsByGroupId,
    reportKeywordFilter,
    selectedCompetitorGroup,
  ]);

  const competitorComparisonSummary =
    React.useMemo<CompetitorComparisonSummary>(() => {
      if (!selectedCompetitorGroup) {
        return {
          winnerTitle: null,
          winnerAverageRank: null,
          overlapCount: 0,
          bestOpportunity: null,
          worstLoss: null,
        };
      }

      const currentByAppKey = new Map<
        string,
        { title: string; ranks: number[] }
      >();
      competitorMovementEntries.forEach((entry) => {
        const appKey = entry.appKey || entry.appId;
        const current = currentByAppKey.get(appKey) || {
          title: entry.appTitle,
          ranks: [],
        };
        current.ranks.push(entry.currentDisplayRank);
        currentByAppKey.set(appKey, current);
      });

      let winnerTitle: string | null = null;
      let winnerAverageRank: number | null = null;
      Array.from(currentByAppKey.entries()).forEach(([, app]) => {
        if (app.ranks.length === 0) return;
        const average =
          app.ranks.reduce((sum, rank) => sum + rank, 0) / app.ranks.length;
        if (winnerAverageRank === null || average < winnerAverageRank) {
          winnerAverageRank = average;
          winnerTitle = app.title;
        }
      });

      const records =
        competitorTrackedKeywordsByGroupId.get(selectedCompetitorGroup.groupId) ||
        [];
      const filteredRecords = records.filter((record) =>
        reportKeywordFilter === "all" ? true : record.keyword === reportKeywordFilter,
      );

      const overlapRecords = filteredRecords.filter(
        (record) => record.apps.filter((app) => app.lastRank !== -1).length >= 2,
      );

      const gapCandidates = filteredRecords
        .map((record) => {
          const ownApp = record.apps.find((app) => app.role === "own");
          const bestCompetitor = [...record.apps]
            .filter((app) => app.role === "competitor" && app.lastRank !== -1)
            .sort((a, b) => a.lastRank - b.lastRank)[0];

          if (!ownApp || !bestCompetitor || ownApp.lastRank === -1) {
            return null;
          }

          return {
            keyword: record.keyword,
            gap: ownApp.lastRank - bestCompetitor.lastRank,
            competitorTitle: bestCompetitor.title,
          };
        })
        .filter(
          (
            value,
          ): value is {
            keyword: string;
            gap: number;
            competitorTitle: string;
          } => Boolean(value && value.gap > 0),
        )
        .sort((a, b) => a.gap - b.gap);

      return {
        winnerTitle,
        winnerAverageRank,
        overlapCount: overlapRecords.length,
        bestOpportunity: gapCandidates[0] || null,
        worstLoss:
          gapCandidates.length > 0
            ? gapCandidates[gapCandidates.length - 1]
            : null,
      };
    }, [
      competitorMovementEntries,
      competitorTrackedKeywordsByGroupId,
      reportKeywordFilter,
      selectedCompetitorGroup,
    ]);

  const myMovers = React.useMemo(
    () => [...myMovementEntries].sort((a, b) => b.absoluteDelta - a.absoluteDelta).slice(0, 8),
    [myMovementEntries],
  );
  const myGainers = React.useMemo(
    () =>
      myMovementEntries
        .filter((entry) => entry.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 8),
    [myMovementEntries],
  );
  const myLosers = React.useMemo(
    () =>
      myMovementEntries
        .filter((entry) => entry.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 8),
    [myMovementEntries],
  );

  const myCompactSummary = React.useMemo<MyCompactSummary>(
    () => ({
      averageRank: myReportSummary.averageRank,
      top10Count: myReportSummary.top10Count,
      top3Count: myReportSummary.top3Count,
      biggestGain: myGainers[0] || null,
      biggestLoss: myLosers[0] || null,
    }),
    [myGainers, myLosers, myReportSummary],
  );

  const competitorMovers = React.useMemo(
    () =>
      [...competitorMovementEntries]
        .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
        .slice(0, 8),
    [competitorMovementEntries],
  );
  const competitorGainers = React.useMemo(
    () =>
      competitorMovementEntries
        .filter((entry) => entry.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 8),
    [competitorMovementEntries],
  );
  const competitorLosers = React.useMemo(
    () =>
      competitorMovementEntries
        .filter((entry) => entry.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 8),
    [competitorMovementEntries],
  );

  const myTrendDomain = React.useMemo(
    () => getYAxisDomainFromSeries(myTrendData.map((point) => point.averageRank)),
    [myTrendData],
  );
  const competitorTrendDomain = React.useMemo(() => {
    const values = competitorTrendData.flatMap((point) =>
      competitorTrendMeta
        .map((meta) => point[meta.appKey])
        .filter((value): value is number => typeof value === "number"),
    );
    return getYAxisDomainFromSeries(values);
  }, [competitorTrendData, competitorTrendMeta]);

  const trackedDistributionItems = React.useMemo(
    () =>
      [
        {
          label: "#1-3",
          value: trackedOverview.top3Count,
          color: "#7c83ff",
        },
        {
          label: "#4-10",
          value: trackedOverview.range4To10Count,
          color: "#29d3ff",
        },
        {
          label: "#11-50",
          value: trackedOverview.range11To50Count,
          color: "#34b6ff",
        },
      ],
    [
      trackedOverview.range4To10Count,
      trackedOverview.range11To50Count,
      trackedOverview.top3Count,
    ],
  );

  const activeTrackedDistributionItems = React.useMemo(
    () => trackedDistributionItems.filter((entry) => entry.value > 0),
    [trackedDistributionItems],
  );

  const mySummaryItems = React.useMemo(
    () => [
      {
        label: "Average Rank",
        value: myCompactSummary.averageRank
          ? myCompactSummary.averageRank.toFixed(1)
          : "-",
        hint: "Current average across the report scope",
      },
      {
        label: "Top 10",
        value: myCompactSummary.top10Count,
        hint: "Keywords currently inside top 10",
      },
      {
        label: "Top 3",
        value: myCompactSummary.top3Count,
        hint: "Highest-value current placements",
      },
      {
        label: "Biggest Gain",
        value: myCompactSummary.biggestGain
          ? formatDelta(myCompactSummary.biggestGain.delta)
          : "-",
        hint: myCompactSummary.biggestGain
          ? myCompactSummary.biggestGain.keyword
          : "No gains in this selection",
      },
      {
        label: "Biggest Loss",
        value: myCompactSummary.biggestLoss
          ? formatDelta(myCompactSummary.biggestLoss.delta)
          : "-",
        hint: myCompactSummary.biggestLoss
          ? myCompactSummary.biggestLoss.keyword
          : "No losses in this selection",
      },
    ],
    [myCompactSummary],
  );

  const competitorSummaryItems = React.useMemo(
    () => [
      {
        label: "Current Winner",
        value: competitorComparisonSummary.winnerTitle || "-",
        hint:
          competitorComparisonSummary.winnerAverageRank !== null
            ? `Avg rank ${competitorComparisonSummary.winnerAverageRank.toFixed(1)}`
            : "No ranked coverage yet",
      },
      {
        label: "Overlap Count",
        value: competitorComparisonSummary.overlapCount,
        hint: "Keywords where multiple apps currently rank",
      },
      {
        label: "Best Opportunity",
        value: competitorComparisonSummary.bestOpportunity
          ? `+${competitorComparisonSummary.bestOpportunity.gap}`
          : "-",
        hint: competitorComparisonSummary.bestOpportunity
          ? `${competitorComparisonSummary.bestOpportunity.keyword} vs ${competitorComparisonSummary.bestOpportunity.competitorTitle}`
          : "No catch-up gap available",
      },
      {
        label: "Worst Loss Gap",
        value: competitorComparisonSummary.worstLoss
          ? `+${competitorComparisonSummary.worstLoss.gap}`
          : "-",
        hint: competitorComparisonSummary.worstLoss
          ? `${competitorComparisonSummary.worstLoss.keyword} vs ${competitorComparisonSummary.worstLoss.competitorTitle}`
          : "No losing gap available",
      },
    ],
    [competitorComparisonSummary],
  );
  const selectedCompetitorAsoDiffs = React.useMemo(
    () =>
      selectedCompetitorGroup
        ? competitorAsoDiffs.filter(
            (diff) => diff.groupId === selectedCompetitorGroup.groupId,
          )
        : [],
    [competitorAsoDiffs, selectedCompetitorGroup],
  );
  const selectedCompetitorAsoSnapshots = React.useMemo(
    () =>
      selectedCompetitorGroup
        ? competitorAsoLatestSnapshots
            .filter((snapshot) => snapshot.groupId === selectedCompetitorGroup.groupId)
            .sort(
              (a, b) =>
                new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
            )
        : [],
    [competitorAsoLatestSnapshots, selectedCompetitorGroup],
  );
  const selectedCompetitorAsoStatus = React.useMemo(() => {
    if (!selectedCompetitorGroup) {
      return {
        label: "No group selected",
        hint: "Choose a competitor group to review ASO monitoring status.",
        emptyMessage: "Select a competitor group to review ASO changes.",
      };
    }
    if (selectedCompetitorAsoDiffs.length > 0) {
      return {
        label: "Changes detected",
        hint: selectedCompetitorAsoDiffs[0]?.detectedAt
          ? `Latest change ${formatReportDateTime(
              selectedCompetitorAsoDiffs[0].detectedAt,
            )}`
          : "Recent ASO metadata changes were logged for this group.",
        emptyMessage: "",
      };
    }
    if (selectedCompetitorAsoSnapshots.length === 0) {
      return {
        label: "Baseline pending",
        hint: "Waiting for the first scheduled monitoring run.",
        emptyMessage:
          "This group has not captured its first ASO baseline yet. The report will populate after monitoring starts and a later run detects a change.",
      };
    }
    if (selectedCompetitorAsoSnapshots.length === 1) {
      return {
        label: "Waiting for first comparison",
        hint: `Baseline saved ${formatReportDateTime(
          selectedCompetitorAsoSnapshots[0].capturedAt,
        )}`,
        emptyMessage:
          "The first ASO baseline has been captured for this group. The next scheduled monitoring run will create the first comparison.",
      };
    }
    return {
      label: "Monitoring active",
      hint: `Last snapshot ${formatReportDateTime(
        selectedCompetitorAsoSnapshots[0].capturedAt,
      )}`,
      emptyMessage:
        "No ASO changes have been logged for this group yet. Snapshots are being captured, and rows appear here only when metadata changes.",
    };
  }, [
    selectedCompetitorAsoDiffs,
    selectedCompetitorAsoSnapshots,
    selectedCompetitorGroup,
  ]);
  const competitorAsoSummaryItems = React.useMemo(
    () => {
      const changedApps = new Set(
        selectedCompetitorAsoDiffs.map((diff) => diff.appTitle),
      );
      const changedCountries = new Set(
        selectedCompetitorAsoDiffs.map((diff) => diff.country),
      );
      const fieldCounts = new Map<string, number>();
      selectedCompetitorAsoDiffs.forEach((diff) => {
        diff.changedFields.forEach((field) => {
          fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
        });
      });
      const topField = Array.from(fieldCounts.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0];
      return [
        {
          label: "ASO Changes",
          value: selectedCompetitorAsoDiffs.length,
          hint: "Logged metadata changes for this competitor group",
        },
        {
          label: "Changed Apps",
          value: changedApps.size,
          hint: "Competitor apps with at least one change event",
        },
        {
          label: "Countries",
          value: changedCountries.size,
          hint: "Tracked countries where changes were detected",
        },
        {
          label: "ASO Status",
          value: selectedCompetitorAsoStatus.label,
          hint: topField
            ? `${selectedCompetitorAsoStatus.hint} Top field: ${topField[0]} (${topField[1]} events).`
            : selectedCompetitorAsoStatus.hint,
        },
      ];
    },
    [selectedCompetitorAsoDiffs, selectedCompetitorAsoStatus],
  );
  const recentCompetitorAsoDiffs = React.useMemo(
    () => selectedCompetitorAsoDiffs.slice(0, 5),
    [selectedCompetitorAsoDiffs],
  );

  const trackedOverviewItems = React.useMemo<PdfSummaryItem[]>(
    () => [
      {
        label: "Last Refresh",
        value: trackedOverview.lastRefreshLabel,
        hint: "Most recent tracked refresh across the workspace",
      },
      {
        label: "Tracking",
        value: "Daily active",
        hint: "Automatic background monitoring",
      },
      {
        label: "Keyword Groups",
        value: trackedOverview.keywordGroups,
        hint: "Tracked group count",
      },
      {
        label: "Ranked Keywords",
        value: trackedOverview.rankedKeywords,
        hint: "Rows currently holding a rank",
      },
      {
        label: "Top 10",
        value: trackedOverview.top10Count,
        hint: "Current top-10 placements",
      },
      {
        label: "Top 3",
        value: trackedOverview.top3Count,
        hint: "Highest-value placements",
      },
      {
        label: "Apps Tracked",
        value: trackedOverview.trackedAppCount,
        hint: "Tracked app records",
      },
      {
        label: "Average Rank",
        value:
          trackedOverview.averageRank !== null
            ? trackedOverview.averageRank.toFixed(1)
            : "-",
        hint: "Current average across ranked rows",
      },
      {
        label: "#4-10",
        value: trackedOverview.range4To10Count,
        hint: "Mid-top-page placements",
      },
      {
        label: "#11-50",
        value: trackedOverview.range11To50Count,
        hint: "Page-two-and-below placements",
      },
    ],
    [trackedOverview],
  );

  const reportExportSnapshot = React.useMemo<ReportsPdfSnapshot>(() => {
    const mapMovementEntry = (entry: ReportMovementEntry) => ({
      appTitle: entry.appTitle,
      country: entry.country,
      currentDisplayRank: entry.currentDisplayRank,
      currentRank: entry.currentRank,
      delta: entry.delta,
      historyLabel: entry.historyLabel,
      keyword: entry.keyword,
      previousDisplayRank: entry.previousDisplayRank,
      previousRank: entry.previousRank,
      store: entry.store,
      trendLabel: entry.trendLabel,
    });

    if (reportMode === "my") {
      const exportTrackedKeywords = trackedCountryRowsForExport.filter((trackedKeyword) => {
        if (
          reportAppFilter !== "all" &&
          trackedKeyword.appTitle !== reportAppFilter
        ) {
          return false;
        }
        if (
          reportStoreFilter !== "all" &&
          trackedKeyword.store !== reportStoreFilter
        ) {
          return false;
        }
        if (
          reportKeywordFilter !== "all" &&
          trackedKeyword.keyword !== reportKeywordFilter
        ) {
          return false;
        }
        return true;
      });
      const exportHistoryRows = exportTrackedKeywords.map((trackedKeyword) => ({
        appTitle: trackedKeyword.appTitle,
        country: trackedKeyword.country,
        history: trackedKeyword.history.map((point) => ({
          rank: point.rawRank,
          rankDepth: point.rankDepth,
          timestamp: point.rawTimestamp,
        })),
        keyword: trackedKeyword.keyword,
        store: trackedKeyword.store,
      }));
      const exportMovementEntries = exportTrackedKeywords
        .map((trackedKeyword) => {
          const periodHistory = filterHistoryByPeriod(trackedKeyword.history, period);
          return buildMovementEntry({
            id: `${trackedKeyword.groupId}:${trackedKeyword.country}`,
            keyword: trackedKeyword.keyword,
            appTitle: trackedKeyword.appTitle,
            appId: trackedKeyword.appId,
            store: trackedKeyword.store,
            country: trackedKeyword.country,
            history: periodHistory,
            historyLabel: `${trackedKeyword.appTitle} in ${findCountryName(trackedKeyword.country) || trackedKeyword.country}`,
          });
        })
        .filter((entry): entry is ReportMovementEntry => Boolean(entry));
      const exportCurrentRanks = exportMovementEntries
        .map((entry) => entry.currentRank)
        .filter((rank) => rank !== -1);
      const exportTrendByDay = new Map<
        string,
        {
          timestamp: string;
          fullTime: string;
          ranks: number[];
          rankedCount: number;
        }
      >();
      exportMovementEntries.forEach((entry) => {
        entry.history.forEach((point) => {
          const current = exportTrendByDay.get(point.dayKey) || {
            timestamp: point.timestamp,
            fullTime: point.fullTime,
            ranks: [],
            rankedCount: 0,
          };
          current.ranks.push(getComparableRank(point));
          if (point.rawRank !== -1) {
            current.rankedCount += 1;
          }
          exportTrendByDay.set(point.dayKey, current);
        });
      });
      const exportTrendData = Array.from(exportTrendByDay.entries())
        .map(([dayKey, entry]) => ({
          averageRank:
            entry.ranks.reduce((sum, rank) => sum + rank, 0) / entry.ranks.length,
          dayKey,
          fullTime: entry.fullTime,
          rankedCount: entry.rankedCount,
          timestamp: entry.timestamp,
        }))
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
      const exportGainers = exportMovementEntries
        .filter((entry) => entry.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 8);
      const exportLosers = exportMovementEntries
        .filter((entry) => entry.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 8);
      const exportMovers = [...exportMovementEntries]
        .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
        .slice(0, 8);
      const exportSummaryItems = [
        {
          label: "Average Rank",
          value:
            exportCurrentRanks.length > 0
              ? (
                  exportCurrentRanks.reduce((sum, rank) => sum + rank, 0) /
                  exportCurrentRanks.length
                ).toFixed(1)
              : "-",
          hint: "Current average across the report scope",
        },
        {
          label: "Top 10",
          value: exportCurrentRanks.filter((rank) => rank <= 10).length,
          hint: "Keywords currently inside top 10",
        },
        {
          label: "Top 3",
          value: exportCurrentRanks.filter((rank) => rank <= 3).length,
          hint: "Highest-value current placements",
        },
        {
          label: "Biggest Gain",
          value: exportGainers[0] ? formatDelta(exportGainers[0].delta) : "-",
          hint: exportGainers[0]
            ? exportGainers[0].keyword
            : "No gains in this selection",
        },
        {
          label: "Biggest Loss",
          value: exportLosers[0] ? formatDelta(exportLosers[0].delta) : "-",
          hint: exportLosers[0]
            ? exportLosers[0].keyword
            : "No losses in this selection",
        },
      ];
      return {
        filters: {
          app: reportAppFilter,
          country: "all",
          keyword: reportKeywordFilter,
          store: reportStoreFilter,
        },
        historyRows: exportHistoryRows,
        keywordBattles: [],
        movement: {
          gainers: exportGainers.map(mapMovementEntry),
          losers: exportLosers.map(mapMovementEntry),
          movers: exportMovers.map(mapMovementEntry),
        },
        period,
        reportMode,
        summaryItems: exportSummaryItems,
        trackedOverviewItems,
        trendSummaryItems: [
          {
            label: "Average Rank",
            value: exportSummaryItems[0].value,
            hint: "Average current rank across the filtered selection",
          },
          {
            label: "Trend Points",
            value: exportTrendData.length,
            hint: "Time buckets rendered for the selected period",
          },
          {
            label: "Ranked Keywords",
            value: exportCurrentRanks.length,
            hint: "Filtered keywords with current positions",
          },
          {
            label: "Regions Monitored",
            value: exportMovementEntries.length,
            hint: "Tracked app/country rows in scope",
          },
        ],
      };
    }

    const competitorGroupName = selectedCompetitorGroup
      ? [
          selectedCompetitorGroup.ownApp.title,
          ...selectedCompetitorGroup.competitors.map((app) => app.title),
        ].join(" vs ")
      : null;

    return {
      competitorGroupName,
      filters: {
        app: reportAppFilter,
        country: "all",
        keyword: reportKeywordFilter,
        store: reportStoreFilter,
      },
      historyRows: selectedCompetitorGroup
        ? (
            competitorTrackedKeywordsByGroupId.get(selectedCompetitorGroup.groupId) || []
          )
            .filter((record) =>
              reportKeywordFilter === "all"
                ? true
                : record.keyword === reportKeywordFilter,
            )
            .flatMap((record) => {
              const historyByApp =
                competitorRankHistoryByTrackedKeywordId.get(
                  record.trackedKeywordId,
                ) || new Map<string, ChartRankHistoryEntry[]>();
              return record.apps.map((app) => ({
                appTitle: app.title,
                country: record.country,
                history: buildTrackedAppChartHistory(
                  app,
                  historyByApp.get(app.appKey) || [],
                ).map((point) => ({
                  rank: point.rawRank,
                  rankDepth: point.rankDepth,
                  timestamp: point.rawTimestamp,
                })),
                keyword: record.keyword,
                store: record.store,
              }));
            })
        : [],
      keywordBattles: competitorKeywordBattles.map((entry) => ({
        keyword: entry.keyword,
        rankedApps: entry.rankedApps
          .map((app) => `${app.title} #${app.lastRank}`)
          .join(" | "),
        rankedAppsCount: entry.rankedApps.length,
      })),
      movement: {
        gainers: competitorGainers.map(mapMovementEntry),
        losers: competitorLosers.map(mapMovementEntry),
        movers: competitorMovers.map(mapMovementEntry),
      },
      period,
      reportMode,
      summaryItems: competitorSummaryItems,
      trackedOverviewItems: [],
      trendSummaryItems: [
        {
          label: "Compared Apps",
          value: selectedCompetitorGroup
            ? 1 + selectedCompetitorGroup.competitors.length
            : 0,
          hint: "Apps included in the active competitor group",
        },
        {
          label: "Trend Points",
          value: competitorTrendData.length,
          hint: "Time buckets rendered for the selected period",
        },
        {
          label: "Tracked Terms",
          value: competitorReportSummary.trackedTerms,
          hint: "Keywords included in this report scope",
        },
        {
          label: "Overlap Count",
          value: competitorComparisonSummary.overlapCount,
          hint: "Keywords where multiple apps currently rank",
        },
      ],
    };
  }, [
    competitorComparisonSummary.overlapCount,
    competitorGainers,
    competitorKeywordBattles,
    competitorLosers,
    competitorMovers,
    competitorReportSummary.trackedTerms,
    competitorSummaryItems,
    competitorTrendData.length,
    myGainers,
    myLosers,
    myMovers,
    myReportSummary.averageRank,
    myReportSummary.rankedKeywords,
    myReportSummary.regionsMonitored,
    mySummaryItems,
    myTrendData.length,
    period,
    reportAppFilter,
    reportCountryFilter,
    reportKeywordFilter,
    reportMode,
    reportStoreFilter,
    selectedCompetitorGroup,
    trackedHistoryByKey,
    trackedCountryRowsForExport,
    trackedKeywords,
    trackedOverviewItems,
    competitorRankHistoryByTrackedKeywordId,
    competitorTrackedKeywordsByGroupId,
  ]);

  const onExportSnapshotChangeRef = React.useRef(onExportSnapshotChange);
  const lastReportedExportSnapshotKeyRef = React.useRef<string | null>(null);
  const reportExportSnapshotKey = React.useMemo(
    () => JSON.stringify(reportExportSnapshot),
    [reportExportSnapshot],
  );
  React.useEffect(() => {
    onExportSnapshotChangeRef.current = onExportSnapshotChange;
  });

  React.useEffect(() => {
    if (lastReportedExportSnapshotKeyRef.current === reportExportSnapshotKey) {
      return;
    }
    lastReportedExportSnapshotKeyRef.current = reportExportSnapshotKey;
    onExportSnapshotChangeRef.current?.(reportExportSnapshot);
  }, [reportExportSnapshot, reportExportSnapshotKey]);

  return (
    <div className="space-y-6">
      <WorkspacePanel tone="strong">
        <div className="flex flex-col gap-3 lg:gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="workspace-chip-label">Reports</div>
            <h2 className="mt-1 text-lg lg:text-xl font-semibold text-app-text">
              Rank movement analysis
            </h2>
            <p className="mt-1 text-xs lg:text-sm text-app-text-muted lg:mt-2">
              Review movement trends, drill into keywords, and compare competitor groups from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 lg:gap-2">
            {REPORT_MODE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setReportMode(option.key)}
                className={`rounded-lg lg:rounded-xl px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-semibold transition-colors ${
                  reportMode === option.key
                    ? "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
                    : "bg-app-surface/45 text-app-text-muted border border-app-border/70 hover:text-app-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 lg:mt-5 flex flex-wrap gap-1.5 lg:gap-2">
          {REPORT_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              className={`rounded-full px-2 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                period === option.key
                  ? "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
                  : "bg-app-surface/45 text-app-text-muted border border-app-border/70 hover:text-app-text"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </WorkspacePanel>

      {reportMode === "my" ? (
        <>
          <WorkspacePanel tone="muted">
            <div className="grid grid-cols-2 gap-2 lg:gap-3 xl:grid-cols-[240px_220px_280px_minmax(0,1fr)]">
              <select
                value={reportStoreFilter}
                onChange={(event) =>
                  setReportStoreFilter(event.target.value as StoreType | "all")
                }
                className="input-field py-2 text-xs lg:py-2.5 lg:text-sm col-span-1"
              >
                <option value="all">All Stores</option>
                <option value="android">Google Play</option>
                <option value="ios">iOS</option>
              </select>
              <div className="col-span-1">
                <CountrySearchSelect
                  value={reportCountryFilter}
                  onChange={setReportCountryFilter}
                  options={COUNTRIES}
                  includeAllOption={{ code: "all", name: "All Countries" }}
                  ariaLabel="Filter report by country"
                  className="w-full text-xs lg:text-sm"
                />
              </div>
              <select
                value={reportAppFilter}
                onChange={(event) => setReportAppFilter(event.target.value)}
                className="input-field py-2 text-xs lg:py-2.5 lg:text-sm col-span-2 sm:col-span-1 xl:col-span-1"
              >
                <option value="all">All Apps</option>
                {trackedAppOptions.map((appTitle) => (
                  <option key={appTitle} value={appTitle}>
                    {appTitle}
                  </option>
                ))}
              </select>
              <select
                value={reportKeywordFilter}
                onChange={(event) => setReportKeywordFilter(event.target.value)}
                className="input-field py-2 text-xs lg:py-2.5 lg:text-sm col-span-2 sm:col-span-1 xl:col-span-1"
              >
                <option value="all">All Keywords</option>
                {myKeywordOptions.map((keyword) => (
                  <option key={keyword} value={keyword}>
                    {keyword}
                  </option>
                ))}
              </select>
            </div>
            {hasKeywordDrilldown ? (
              <div className="workspace-compact-banner mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-3 py-2 lg:mt-4 lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-3">
                <span className="text-xs text-app-text-muted lg:text-sm">
                  Viewing keyword drilldown for{" "}
                  <span className="font-semibold text-cyan-200">
                    {reportKeywordFilter}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setReportKeywordFilter("all")}
                  className="inline-flex items-center gap-1.5 lg:gap-2 rounded-lg lg:rounded-xl border border-app-border/70 bg-app-surface/70 px-2.5 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-xs font-semibold text-app-text transition-colors hover:border-cyan-500/30 hover:text-cyan-200"
                >
                  <ArrowLeft className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                  Back to all keywords
                </button>
              </div>
            ) : null}
          </WorkspacePanel>

          <WorkspacePanel tone="muted">
            <div className="mb-3 lg:mb-4">
              <div className="workspace-chip-label">Quick Summary</div>
              <h3 className="mt-1 text-base lg:text-lg font-semibold text-app-text">
                What changed in this period
              </h3>
            </div>
            <CompactStatGrid items={mySummaryItems} />
          </WorkspacePanel>

          <ReportSection
            title="Keyword Trend"
            description="Average rank across the filtered tracked set for the selected time window."
            icon={LineChart}
          >
            {myTrendData.length === 0 ? (
              <WorkspaceEmptyBlock
                icon={BarChart3}
                title="No report trend yet"
                description="Adjust the report filters or wait for more tracked rank history in this period."
              />
            ) : (
              <div className="workspace-mobile-chart h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={myTrendData}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={myTrendDomain}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={ChartTooltip} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="averageRank"
                      name="Average rank"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: "#22d3ee" }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ReportSection>

          <WorkspacePanel tone="muted">
            <button
              type="button"
              onClick={() => setIsTrackedOverviewOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left sm:gap-4"
            >
              <div>
                <div className="workspace-chip-label">Secondary Overview</div>
                <h3 className="mt-1 text-base font-semibold text-app-text sm:text-lg">
                  Ranking coverage at a glance
                </h3>
                <p className="mt-1 hidden text-sm text-app-text-muted sm:block">
                  Expand for the fuller tracked distribution and monitoring snapshot.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-xl border border-app-border/70 bg-app-surface/60 px-2.5 py-1.5 text-[10px] font-semibold text-app-text sm:px-3 sm:py-2 sm:text-xs">
                {isTrackedOverviewOpen ? "Hide overview" : "Show overview"}
                {isTrackedOverviewOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            {isTrackedOverviewOpen ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_320px] sm:mt-5 sm:gap-5">
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="workspace-chip-label">Overview</div>
                      <h4 className="mt-1 text-lg font-semibold text-app-text sm:text-xl">
                        Ranking coverage at a glance
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="workspace-status-chip">
                        Last refresh {trackedOverview.lastRefreshLabel}
                      </span>
                      <span className="workspace-status-chip">
                        Daily active
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="workspace-mini-stat">
                      <div className="workspace-chip-label">Keyword Groups</div>
                      <div className="mt-1 text-3xl font-display font-bold text-app-text">
                        {trackedOverview.keywordGroups}
                      </div>
                      <div className="mt-2 text-xs text-app-text-muted">
                        Tracked group count
                      </div>
                    </div>
                    <div className="workspace-mini-stat">
                      <div className="workspace-chip-label">Top 10 Rankings</div>
                      <div className="mt-1 text-3xl font-display font-bold text-app-text">
                        {trackedOverview.top10Count}
                      </div>
                      <div className="mt-2 text-xs text-app-text-muted">
                        Across all countries
                      </div>
                    </div>
                    <div className="workspace-mini-stat">
                      <div className="workspace-chip-label">#1-3 Positions</div>
                      <div className="mt-1 text-3xl font-display font-bold text-app-text">
                        {trackedOverview.top3Count}
                      </div>
                      <div className="mt-2 text-xs text-app-text-muted">
                        Highest-value placements
                      </div>
                    </div>
                    <div className="workspace-mini-stat">
                      <div className="workspace-chip-label">Apps Tracked</div>
                      <div className="mt-1 text-3xl font-display font-bold text-app-text">
                        {trackedOverview.trackedAppCount}
                      </div>
                      <div className="mt-2 text-xs text-app-text-muted">
                        Tracked app records
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="workspace-chip-label">Rank Distribution</div>
                      <h4 className="mt-1 text-xl font-semibold text-app-text">
                        Current tracked spread
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                        Avg rank
                      </div>
                      <div className="mt-1 text-sm font-semibold text-app-text-muted">
                        {trackedOverview.averageRank
                          ? trackedOverview.averageRank.toFixed(1)
                          : "-"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 lg:mt-5 lg:flex-row lg:items-center lg:gap-4">
                    <div className="h-44 w-full sm:h-52 lg:max-w-[210px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={activeTrackedDistributionItems}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={72}
                            stroke="rgba(15,23,42,0.85)"
                            strokeWidth={4}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {activeTrackedDistributionItems
                              .map((entry) => (
                                <Cell key={entry.label} fill={entry.color} />
                              ))}
                            <Label
                              content={PieDonutLabel}
                              value={trackedOverview.rankedKeywords}
                            />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-3">
                      {trackedDistributionItems.map((item) => (
                        <div
                          key={item.label}
                           className="flex items-center justify-between rounded-xl border border-app-border/60 bg-app-surface/45 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3"
                        >
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-app-text">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: item.color }}
                            />
                            <span className="line-clamp-1">{item.label}</span>
                          </div>
                          <span className="text-lg font-display font-bold text-app-text sm:text-xl">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </WorkspacePanel>

          <TabbedMovementSection
            title="Movement"
            description="Switch between absolute movers, gainers, and losers without leaving the report."
            selectedTab={myMovementTab}
            onChangeTab={setMyMovementTab}
            movers={myMovers}
            gainers={myGainers}
            losers={myLosers}
            onSelectKeyword={setReportKeywordFilter}
          />
        </>
      ) : (
        <>
          <WorkspacePanel tone="muted">
            <div className="workspace-compact-controls grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <select
                value={competitorGroupFilter}
                onChange={(event) => setCompetitorGroupFilter(event.target.value)}
                className="input-field py-2.5"
              >
                {competitorGroups.length === 0 ? (
                  <option value="">No saved competitor groups</option>
                ) : null}
                {competitorGroups.map((group) => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.ownApp.title} vs {group.competitors.map((app) => app.title).join(", ")}
                  </option>
                ))}
              </select>
              <select
                value={reportKeywordFilter}
                onChange={(event) => setReportKeywordFilter(event.target.value)}
                className="input-field py-2.5"
                disabled={!selectedCompetitorGroup}
              >
                <option value="all">All Group Keywords</option>
                {competitorKeywordOptions.map((keyword) => (
                  <option key={keyword} value={keyword}>
                    {keyword}
                  </option>
                ))}
              </select>
            </div>
            {hasKeywordDrilldown ? (
              <div className="workspace-compact-banner mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3">
                <span className="text-xs text-app-text-muted sm:text-sm">
                  Viewing keyword drilldown for{" "}
                  <span className="font-semibold text-cyan-200">
                    {reportKeywordFilter}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setReportKeywordFilter("all")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-app-border/70 bg-app-surface/70 px-2.5 py-1.5 text-[10px] font-semibold text-app-text transition-colors hover:border-cyan-500/30 hover:text-cyan-200 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to all keywords
                </button>
                {selectedCompetitorGroup && onEditCompetitorKeywordCountries ? (
                  <button
                    type="button"
                    onClick={() =>
                      onEditCompetitorKeywordCountries({
                        groupId: selectedCompetitorGroup.groupId,
                        keyword: reportKeywordFilter,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-app-border/70 bg-app-surface/70 px-2.5 py-1.5 text-[10px] font-semibold text-app-text transition-colors hover:border-cyan-500/30 hover:text-cyan-200 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Edit Countries
                  </button>
                ) : null}
              </div>
            ) : null}
          </WorkspacePanel>

          {!selectedCompetitorGroup ? (
            <WorkspaceEmptyBlock
              icon={Globe}
              title="No competitor group selected"
              description="Save a competitor group from the Competitors page to unlock group movement reports."
            />
          ) : (
            <>
              <WorkspacePanel tone="muted">
                <div className="mb-4">
                  <div className="workspace-chip-label">Comparison Summary</div>
                  <h3 className="mt-1 text-lg font-semibold text-app-text">
                    Who is winning and where the gaps are
                  </h3>
                </div>
                <CompactStatGrid
                  items={competitorSummaryItems}
                  columnsClassName="xl:grid-cols-4"
                />
              </WorkspacePanel>

              <WorkspacePanel tone="muted">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="workspace-chip-label">ASO Change Summary</div>
                    <h3 className="mt-1 text-lg font-semibold text-app-text">
                      Recent competitor metadata changes
                    </h3>
                    <p className="mt-2 hidden text-sm text-app-text-muted sm:block">
                      Brief reporting coverage for title, description, icon,
                      category, and screenshot updates across all tracked
                      countries in this competitor group.
                    </p>
                  </div>
                  <div className="text-xs text-app-text-muted">
                    Detailed ASO history and alert setup stays in Competitors.
                  </div>
                </div>
                <CompactStatGrid
                  items={competitorAsoSummaryItems}
                  columnsClassName="xl:grid-cols-4"
                />
                {recentCompetitorAsoDiffs.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-app-border/60 bg-app-surface/45 px-4 py-6 text-sm text-app-text-muted">
                    {selectedCompetitorAsoStatus.emptyMessage}
                  </div>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/45 sm:mt-5">
                    <div className="hidden lg:grid grid-cols-[150px_180px_110px_minmax(0,1fr)] gap-3 border-b border-app-border/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                      <div>Detected</div>
                      <div>App</div>
                      <div>Country</div>
                      <div>Change Summary</div>
                    </div>
                    {recentCompetitorAsoDiffs.map((diff) => (
                      <div
                        key={diff.diffId}
                        className="flex flex-col lg:grid lg:grid-cols-[150px_180px_110px_minmax(0,1fr)] gap-3 border-b border-app-border/80 px-4 py-3 text-sm text-app-text-muted last:border-b-0"
                      >
                        <div className="text-xs text-app-text-muted">
                          <span className="lg:hidden font-semibold mr-1">Detected:</span>
                          {formatReportDateTime(diff.detectedAt)}
                        </div>
                        <div className="font-semibold text-app-text">
                          {diff.appTitle}
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                          <span className="lg:hidden text-app-text-muted mr-1">Country:</span>
                          {diff.country}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {diff.changedFields.map((field) => (
                              <span
                                key={`${diff.diffId}:${field}`}
                                className="rounded-full border border-app-border/60 bg-app-surface-muted/70 px-2 py-1 text-[10px] font-semibold text-app-text"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-app-text-muted">
                            {diff.changes.map((change) => change.summary).join(" ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </WorkspacePanel>

              <ReportSection
                title="Competitor Trend"
                description="Average position per app across the tracked competitive keyword set."
                icon={ArrowRightLeft}
              >
                {competitorTrendData.length === 0 ? (
                  <WorkspaceEmptyBlock
                    icon={BarChart3}
                    title="No competitor trend yet"
                    description="This group needs more rank history in the selected period before a comparison trend can be plotted."
                  />
                ) : (
                  <div className="workspace-mobile-chart h-80 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={competitorTrendData}>
                        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={competitorTrendDomain}
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={ChartTooltip} />
                        <Legend />
                        {competitorTrendMeta.map((meta) => (
                          <Line
                            key={meta.appKey}
                            type="monotone"
                            dataKey={meta.appKey}
                            name={meta.title}
                            stroke={meta.color}
                            strokeWidth={2.25}
                            dot={false}
                            activeDot={{ r: 4, fill: meta.color }}
                            connectNulls
                          />
                        ))}
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ReportSection>

              <TabbedMovementSection
                title="Movement"
                description="Review the biggest competitor shifts in one place."
                selectedTab={competitorMovementTab}
                onChangeTab={setCompetitorMovementTab}
                movers={competitorMovers}
                gainers={competitorGainers}
                losers={competitorLosers}
                onSelectKeyword={setReportKeywordFilter}
              />

              <ReportSection
                title="Keyword Battles"
                description="Terms where multiple apps are currently ranking and the fight is still active."
                icon={Swords}
              >
                {competitorKeywordBattles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-app-border/70 bg-app-surface/35 px-4 py-6 text-sm text-app-text-muted">
                    No overlapping ranked keywords surfaced for this group and period.
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {competitorKeywordBattles.map((battle) => (
                      <div
                        key={battle.keyword}
                        className="rounded-2xl border border-app-border/70 bg-app-surface/45 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-app-text">
                              {battle.keyword}
                            </p>
                            <p className="mt-1 text-xs text-app-text-muted">
                              {battle.rankedApps.length} apps currently rank here
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReportKeywordFilter(battle.keyword)}
                            className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200"
                          >
                            Drill in
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {battle.rankedApps.map((app) => (
                            <span
                              key={`${battle.keyword}-${app.appKey}`}
                              className="rounded-full border border-app-border/70 bg-app-surface-muted/80 px-2.5 py-1 text-xs text-app-text-muted"
                            >
                              {app.title} #{app.lastRank}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ReportSection>
            </>
          )}
        </>
      )}
    </div>
  );
}

