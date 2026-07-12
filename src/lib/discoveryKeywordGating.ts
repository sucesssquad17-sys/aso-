import type { KeywordFeatureVector } from "./keywordMetrics";

export type DiscoveryMode = "fast" | "deep";

export type DiscoveryAdmissionFeatures = Pick<
  KeywordFeatureVector,
  | "exactTitleMatch"
  | "exactTitleSegment"
  | "orderedTitleCoverage"
  | "titleCoverage"
  | "appTitleCoverage"
  | "descriptionCoverage"
  | "genericCoverage"
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
  "changelog",
  "bug",
  "bugs",
  "fix",
  "fixes",
  "fixed",
  "patch",
  "patches",
  "improvement",
  "improvements",
  "performance",
  "experience",
]);

const SOFT_NOISE_WORDS = new Set([
  "update",
  "updates",
  "updated",
  "feature",
  "features",
  "latest",
  "release-notes",
  "bugfix",
  "bugfixes",
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
  const noisyWordCount = words.filter(
    (word) =>
      BAD_STEMS.has(word) ||
      PURE_TRASH_WORDS.has(word) ||
      SOFT_NOISE_WORDS.has(word),
  ).length;
  if (
    noisyWordCount === words.length ||
    (words.length === 1 &&
      noisyWordCount === 1)
  ) {
    return false;
  }
  if (words.length >= 3 && noisyWordCount >= Math.ceil(words.length / 2)) {
    return false;
  }
  if (words.length > 1 && FILLERS.has(words[words.length - 1])) return false;

  return true;
}

export function hasStrongDiscoverySignal(
  features: DiscoveryAdmissionFeatures,
) {
  return (
    features.exactTitleMatch > 0 ||
    features.exactTitleSegment > 0 ||
    features.orderedTitleCoverage >= 0.55 ||
    features.semanticCoverage >= 0.35 ||
    features.categorySemanticCoverage >= 0.35
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
          displayQuality: 0,
          semanticCoverage: 0.12,
          categorySemanticCoverage: 0.12,
        }
      : {
          displayQuality: 8,
          semanticCoverage: 0.18,
          categorySemanticCoverage: 0.18,
        };

  return (
    displayQuality >= thresholds.displayQuality ||
    features.semanticCoverage >= thresholds.semanticCoverage ||
    features.categorySemanticCoverage >= thresholds.categorySemanticCoverage
  );
}
