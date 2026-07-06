export type DiscoveryResponseStatus = "ok" | "partial" | "fallback";

export type DiscoveryCompetitorMiningStatus =
  | "ok"
  | "skipped"
  | "timeout"
  | "failed";

export type DiscoveryVerificationSummary = {
  attempted: number;
  succeeded: number;
  failed: number;
  timedOut: number;
};

export function buildDiscoveryWarnings(input: {
  fallback?: boolean;
  competitorMiningStatus?: DiscoveryCompetitorMiningStatus;
  failedLookups?: number;
  timedOutLookups?: number;
}) {
  const warnings: string[] = [];

  if (input.fallback) {
    warnings.push("Showing fallback discovery suggestions.");
  }

  if (input.competitorMiningStatus === "timeout") {
    warnings.push(
      "Competitor mining timed out, so discovery used app metadata only.",
    );
  } else if (input.competitorMiningStatus === "failed") {
    warnings.push(
      "Competitor mining failed, so discovery used app metadata only.",
    );
  }

  if ((input.timedOutLookups || 0) > 0) {
    warnings.push(
      "Rank verification timed out for some keywords, so unverified suggestions are shown.",
    );
  } else if ((input.failedLookups || 0) > 0) {
    warnings.push(
      "Some rank verifications failed, so unverified suggestions are shown.",
    );
  }

  return warnings;
}

export function resolveDiscoveryResponseStatus(input: {
  fallback?: boolean;
  warnings?: string[];
}) {
  if (input.fallback) {
    return "fallback" satisfies DiscoveryResponseStatus;
  }

  return (input.warnings?.length ?? 0) > 0 ? "partial" : "ok";
}
