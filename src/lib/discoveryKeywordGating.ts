import type { KeywordFeatureVector } from "./keywordMetrics";

export type DiscoveryMode = "fast" | "deep";

export type DiscoveryAdmissionFeatures = Pick<
  KeywordFeatureVector,
  | "exactTitleMatch"
  | "exactTitleSegment"
  | "orderedTitleCoverage"
  | "semanticCoverage"
  | "categorySemanticCoverage"
>;

const BAD_STEMS = new Set([
  "articl",
  "featur",
  "gam",
  "improv",
  "introduc",
  "manag",
  "messag",
  "optim",
  "perform",
  "provid",
  "resolv",
  "stat",
  "updat",
  "experienc",
  "enhanc",
  "bugfix",
]);

const PURE_TRASH_WORDS = new Set([
  "version",
  "release",
  "notes",
  "bug",
  "bugs",
  "fix",
  "fixes",
  "fixed",
  "improvement",
  "improvements",
  "performance",
  "experience",
]);

const FILLERS = new Set([
  "and",
  "the",
  "for",
  "with",
  "to",
  "in",
  "of",
  "a",
  "an",
  "is",
  "by",
  "on",
  "at",
  "it",
  "my",
  "your",
  "this",
  "that",
  "how",
  "what",
  "why",
  "get",
  "let",
]);

export function isDiscoveryKeywordCandidate(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (/[^a-z0-9\s\-\.&]/i.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  if (words.some((word) => BAD_STEMS.has(word))) return false;
  if (words.some((word) => PURE_TRASH_WORDS.has(word))) return false;
  if (words.length > 1 && FILLERS.has(words[words.length - 1])) return false;

  return true;
}

export function hasStrongDiscoverySignal(
  features: DiscoveryAdmissionFeatures,
) {
  return (
    features.exactTitleMatch > 0 ||
    features.exactTitleSegment > 0 ||
    features.orderedTitleCoverage >= 0.75 ||
    features.semanticCoverage >= 0.5 ||
    features.categorySemanticCoverage >= 0.5
  );
}

export function shouldAdmitDiscoveryCandidate(
  mode: DiscoveryMode,
  features: DiscoveryAdmissionFeatures,
  displayQuality: number,
) {
  if (hasStrongDiscoverySignal(features)) return true;

  const thresholds =
    mode === "deep"
      ? {
          displayQuality: 10,
          semanticCoverage: 0.25,
          categorySemanticCoverage: 0.25,
        }
      : {
          displayQuality: 20,
          semanticCoverage: 0.35,
          categorySemanticCoverage: 0.35,
        };

  return (
    displayQuality >= thresholds.displayQuality ||
    features.semanticCoverage >= thresholds.semanticCoverage ||
    features.categorySemanticCoverage >= thresholds.categorySemanticCoverage
  );
}
