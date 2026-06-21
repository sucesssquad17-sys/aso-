import React from "react";
import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { ChartRankHistoryEntry } from "../features/tracking/model";

type RankSparklineProps = {
  data: ChartRankHistoryEntry[];
  stroke: string;
  className?: string;
  emptyLabel?: string;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: ChartRankHistoryEntry;
  }>;
};

function RankSparklineTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/95 px-2.5 py-2 text-[10px] text-slate-200 shadow-2xl backdrop-blur-xl">
      <p className="font-semibold text-slate-100">{point.fullTime}</p>
      <p className="mt-1 text-slate-400">
        Rank:{" "}
        <span className="font-bold text-cyan-300">
          {point.rawRank === -1 ? `Not in top ${point.rankDepth}` : `#${point.rank}`}
        </span>
      </p>
    </div>
  );
}

const RankSparkline = React.memo(function RankSparkline({
  data,
  stroke,
  className,
  emptyLabel = "No history yet",
}: RankSparklineProps) {
  const gradientId = React.useId().replace(/:/g, "");
  const chartData = React.useMemo(() => {
    if (data.length === 0) return [];
    return data.map((point) => ({
      ...point,
      tooltipRank:
        point.rawRank === -1
          ? point.rankDepth + 1
          : point.rank,
    }));
  }, [data]);

  const yDomain = React.useMemo<[number, number] | null>(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map((point) => point.tooltipRank);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return [Math.max(1, min - 1), max + 1];
    }
    return [min, max];
  }, [chartData]);

  if (chartData.length === 0 || !yDomain) {
    return (
      <div
        className={`flex h-full items-center justify-center text-[10px] text-slate-600 ${className || ""}`.trim()}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full overflow-hidden rounded-lg border border-slate-900/70 bg-slate-950/35 ${className || ""}`.trim()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <YAxis
            hide
            domain={yDomain}
          />
          <Tooltip
            content={<RankSparklineTooltip />}
            cursor={{
              stroke: "rgba(103, 232, 249, 0.22)",
              strokeWidth: 1,
              strokeDasharray: "3 4",
            }}
            wrapperStyle={{ outline: "none" }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="tooltipRank"
            stroke="none"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="tooltipRank"
            stroke={stroke}
            strokeWidth={2.25}
            dot={
              chartData.length === 1
                ? {
                    r: 3.5,
                    fill: stroke,
                    stroke: "#020617",
                    strokeWidth: 1.5,
                  }
                : false
            }
            activeDot={{
              r: 4,
              fill: stroke,
              stroke: "#020617",
              strokeWidth: 1.5,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default RankSparkline;
