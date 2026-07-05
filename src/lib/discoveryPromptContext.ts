import {
  HIGH_VOLUME_TERMS,
  deriveCategoryHints,
  normalizeKeyword,
  tokenize,
} from "./keywordMetrics";
import {
  isDiscoveryKeywordCandidate,
  type DiscoveryMode,
} from "./discoveryKeywordGating";

export type DiscoveryPromptLimits = {
  promptCandidateLimit: number;
  featureSummaryLimit: number;
  outputKeywordLimit: number;
  outputTokenLimit: number;
  minimumUsableCount: number;
  appPurposeLimit: number;
  targetUsersLimit: number;
  coreFeaturesLimit: number;
  useCasesLimit: number;
  painPointsLimit: number;
  competitorRepeatedTermsLimit: number;
  rawDescriptionExcerptChars: number;
};

export type DiscoveryPromptContext = {
  title: string;
  description?: string;
  category?: string;
  developer?: string;
  store: string;
  country: string;
};

export type DiscoveryPromptSections = {
  appPurpose: string[];
  targetUsers: string[];
  coreFeatures: string[];
  useCases: string[];
  painPointsSolved: string[];
  highSignalDescriptionPhrases: string[];
  competitorRepeatedTerms: string[];
  candidateKeywords: string[];
  excludedBrandTokens: string[];
  rawDescriptionExcerpt: string;
};

export type DiscoveryPromptSectionCounts = {
  appPurposeCount: number;
  targetUsersCount: number;
  coreFeatureCount: number;
  useCaseCount: number;
  painPointCount: number;
  featureLineCount: number;
  competitorRepeatedTermCount: number;
  promptSectionCount: number;
  rawDescriptionExcerptLength: number;
};

const RELEASE_NOTE_PATTERN =
  /\b(update|updated|version|release|bug|bugs|fix|fixed|fixes|crash|performance|privacy|policy|terms)\b/i;
const AUDIENCE_MARKERS = new Set([
  "adhd",
  "adult",
  "beginner",
  "busy",
  "child",
  "couple",
  "creator",
  "family",
  "freelancer",
  "kid",
  "parent",
  "professional",
  "remote",
  "runner",
  "small business",
  "student",
  "teacher",
  "team",
  "therapist",
  "woman",
  "women",
  "worker",
  "writer",
]);
const USE_CASE_MARKERS = new Set([
  "build",
  "create",
  "follow",
  "journal",
  "log",
  "manage",
  "organize",
  "plan",
  "prepare",
  "remember",
  "schedule",
  "start",
  "stay",
  "track",
]);
const PAIN_POINT_MARKERS = new Set([
  "adhd",
  "avoid",
  "calm",
  "chaos",
  "consistent",
  "focus",
  "forget",
  "habit",
  "motivation",
  "overwhelm",
  "procrastination",
  "routine",
  "stress",
  "streak",
  "time",
]);

function dedupeNormalized(values: string[], limit: number) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = normalizeKeyword(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

function keywordHasExcludedBrandToken(value: string, excludedBrandTokens: Set<string>) {
  if (excludedBrandTokens.size === 0) {
    return false;
  }

  return tokenize(value).some((token) => excludedBrandTokens.has(token));
}

function splitDescriptionChunks(description: string | undefined) {
  if (!description) {
    return [];
  }

  return String(description)
    .split(/[\r\n]+|[•·▪●]|[.!?;:]+/)
    .map((chunk) => normalizeKeyword(chunk))
    .filter(Boolean);
}

function scoreDescriptionChunk(chunk: string) {
  const rawWords = normalizeKeyword(chunk)
    .split(" ")
    .filter((word) => word.length > 2);
  const tokens = tokenize(chunk).filter((token) => token.length > 2);
  if (tokens.length < 2 || rawWords.length < 2 || RELEASE_NOTE_PATTERN.test(chunk)) {
    return null;
  }

  const meaningfulTokenCount = tokens.filter((token) => !HIGH_VOLUME_TERMS.has(token)).length;
  const score =
    meaningfulTokenCount * 3 +
    Math.min(tokens.length, 6) +
    (tokens.length >= 4 && tokens.length <= 8 ? 3 : 0);

  return {
    score,
    text: rawWords.slice(0, 10).join(" "),
    tokens,
  };
}

function normalizeDescriptionSignals(description: string | undefined) {
  const chunks = splitDescriptionChunks(description);
  const seen = new Set<string>();

  return chunks
    .map((chunk) => scoreDescriptionChunk(chunk))
    .filter((entry): entry is NonNullable<ReturnType<typeof scoreDescriptionChunk>> => Boolean(entry))
    .filter((entry) => {
      if (seen.has(entry.text)) {
        return false;
      }
      seen.add(entry.text);
      return true;
    })
    .sort((left, right) => right.score - left.score);
}

function lineHasAnyMarker(line: string, markers: Set<string>) {
  const normalized = normalizeKeyword(line);
  if (!normalized) {
    return false;
  }

  for (const marker of markers) {
    if (normalized.includes(marker)) {
      return true;
    }
  }

  return false;
}

function buildAudienceLines(
  rankedLines: ReturnType<typeof normalizeDescriptionSignals>,
  categoryHints: Set<string>,
  limit: number,
) {
  const candidates = rankedLines
    .filter(({ text, tokens }) =>
      lineHasAnyMarker(text, AUDIENCE_MARKERS) ||
      tokens.some((token) => categoryHints.has(token) && token.length > 4),
    )
    .map(({ text }) => text);

  return dedupeNormalized(candidates, limit);
}

function buildUseCaseLines(
  rankedLines: ReturnType<typeof normalizeDescriptionSignals>,
  limit: number,
) {
  const candidates = rankedLines
    .filter(({ text, tokens }) =>
      lineHasAnyMarker(text, USE_CASE_MARKERS) ||
      tokens.some((token) => USE_CASE_MARKERS.has(token)),
    )
    .map(({ text }) => text);

  return dedupeNormalized(candidates, limit);
}

function buildPainPointLines(
  rankedLines: ReturnType<typeof normalizeDescriptionSignals>,
  limit: number,
) {
  const candidates = rankedLines
    .filter(({ text, tokens }) =>
      lineHasAnyMarker(text, PAIN_POINT_MARKERS) ||
      tokens.some((token) => PAIN_POINT_MARKERS.has(token)),
    )
    .map(({ text }) => text);

  return dedupeNormalized(candidates, limit);
}

function buildPurposeLines(
  context: DiscoveryPromptContext,
  featureLines: string[],
  useCases: string[],
  limit: number,
) {
  const categoryHints = deriveCategoryHints(context.category);
  const candidates = [
    ...featureLines.slice(0, 2),
    ...useCases.slice(0, 2),
    ...categoryHints.slice(0, 2).map((hint) => `${hint} ${context.store} app`),
    context.category ? `${context.category} ${context.store} app` : "",
  ].filter(Boolean);

  return dedupeNormalized(candidates, limit);
}

function buildRawDescriptionExcerpt(description: string | undefined, charLimit: number) {
  if (!description) {
    return "";
  }

  const excerpt = normalizeKeyword(description)
    .replace(/\s+/g, " ")
    .trim();
  if (!excerpt) {
    return "";
  }

  if (excerpt.length <= charLimit) {
    return excerpt;
  }

  const trimmed = excerpt.slice(0, charLimit);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 48 ? trimmed.slice(0, lastSpace) : trimmed).trim();
}

function renderListSection(label: string, values: string[]) {
  if (values.length === 0) {
    return "";
  }

  return `${label}:\n${values.map((value) => `- ${value}`).join("\n")}`;
}

function renderTextSection(label: string, value: string) {
  if (!value) {
    return "";
  }

  return `${label}:\n${value}`;
}

export function compactDiscoveryPromptCandidates(rawKeywords: string[], limit: number) {
  return dedupeNormalized(
    rawKeywords.filter(isDiscoveryKeywordCandidate),
    limit,
  );
}

export function extractDiscoveryFeatureSummary(
  description: string | undefined,
  limit: number,
) {
  return normalizeDescriptionSignals(description)
    .slice(0, limit)
    .map((entry) => entry.text);
}

export function buildDiscoveryPromptSections(input: {
  candidateKeywords: string[];
  competitorRepeatedTerms: string[];
  context: DiscoveryPromptContext;
  excludedBrandTokens: string[];
  limits: DiscoveryPromptLimits;
}) {
  const excludedBrandTokenSet = new Set(
    input.excludedBrandTokens.flatMap((token) => tokenize(token)),
  );
  const highSignalDescriptionPhrases = extractDiscoveryFeatureSummary(
    input.context.description,
    input.limits.featureSummaryLimit,
  );
  const rankedDescriptionLines = normalizeDescriptionSignals(input.context.description);
  const categoryHints = new Set(
    deriveCategoryHints(input.context.category).flatMap((hint) => tokenize(hint)),
  );

  const targetUsers = buildAudienceLines(
    rankedDescriptionLines,
    categoryHints,
    input.limits.targetUsersLimit,
  );
  const useCases = buildUseCaseLines(
    rankedDescriptionLines,
    input.limits.useCasesLimit,
  );
  const painPointsSolved = buildPainPointLines(
    rankedDescriptionLines,
    input.limits.painPointsLimit,
  );
  const coreFeatures = dedupeNormalized(
    rankedDescriptionLines.map(({ text }) => text),
    input.limits.coreFeaturesLimit,
  );
  const appPurpose = buildPurposeLines(
    input.context,
    highSignalDescriptionPhrases,
    useCases,
    input.limits.appPurposeLimit,
  );
  const competitorRepeatedTerms = dedupeNormalized(
    input.competitorRepeatedTerms.filter(
      (term) => !keywordHasExcludedBrandToken(term, excludedBrandTokenSet),
    ),
    input.limits.competitorRepeatedTermsLimit,
  );
  const candidateKeywords = dedupeNormalized(
    input.candidateKeywords,
    input.limits.promptCandidateLimit,
  );
  const excludedBrandTokens = dedupeNormalized(
    input.excludedBrandTokens,
    input.excludedBrandTokens.length,
  );
  const rawDescriptionExcerpt = buildRawDescriptionExcerpt(
    input.context.description,
    input.limits.rawDescriptionExcerptChars,
  );

  const sections: DiscoveryPromptSections = {
    appPurpose,
    targetUsers,
    coreFeatures,
    useCases,
    painPointsSolved,
    highSignalDescriptionPhrases,
    competitorRepeatedTerms,
    candidateKeywords,
    excludedBrandTokens,
    rawDescriptionExcerpt,
  };

  const counts: DiscoveryPromptSectionCounts = {
    appPurposeCount: sections.appPurpose.length,
    targetUsersCount: sections.targetUsers.length,
    coreFeatureCount: sections.coreFeatures.length,
    useCaseCount: sections.useCases.length,
    painPointCount: sections.painPointsSolved.length,
    featureLineCount: sections.highSignalDescriptionPhrases.length,
    competitorRepeatedTermCount: sections.competitorRepeatedTerms.length,
    promptSectionCount: [
      sections.appPurpose.length,
      sections.targetUsers.length,
      sections.coreFeatures.length,
      sections.useCases.length,
      sections.painPointsSolved.length,
      sections.highSignalDescriptionPhrases.length,
      sections.competitorRepeatedTerms.length,
      sections.candidateKeywords.length,
      sections.excludedBrandTokens.length,
      sections.rawDescriptionExcerpt.length > 0 ? 1 : 0,
    ].filter((count) => count > 0).length,
    rawDescriptionExcerptLength: sections.rawDescriptionExcerpt.length,
  };

  return { sections, counts };
}

export function buildDiscoveryRefinementPrompt(input: {
  context: DiscoveryPromptContext;
  limits: DiscoveryPromptLimits;
  mode: DiscoveryMode;
  sections: DiscoveryPromptSections;
}) {
  const blocks = [
    "You are an App Store Optimization keyword strategist.",
    "Return only real user-searchable ASO keywords for this app.",
    "",
    "App metadata:",
    `- Title: ${input.context.title || "N/A"}`,
    `- Category: ${input.context.category || "N/A"}`,
    `- Developer: ${input.context.developer || "N/A"}`,
    `- Store: ${input.context.store}`,
    `- Country: ${input.context.country}`,
    "",
    renderListSection("App purpose", input.sections.appPurpose),
    renderListSection("Target users", input.sections.targetUsers),
    renderListSection("Core features", input.sections.coreFeatures),
    renderListSection("Use cases", input.sections.useCases),
    renderListSection("Pain points solved", input.sections.painPointsSolved),
    renderListSection("High-signal phrases from description", input.sections.highSignalDescriptionPhrases),
    renderTextSection("Raw description excerpt", input.sections.rawDescriptionExcerpt),
    renderListSection("Competitor repeated terms", input.sections.competitorRepeatedTerms),
    renderListSection("Candidate keywords", input.sections.candidateKeywords),
    renderListSection("Avoid competitor brands", input.sections.excludedBrandTokens),
    "Rules:",
    "1. Return only a JSON array of strings. No markdown. No commentary.",
    `2. Include at most ${input.limits.outputKeywordLimit} keywords.`,
    "3. Use the app purpose, audience, use cases, pain points, and competitor repetition to discover concrete ASO phrases instead of generic head terms.",
    "4. Prefer natural head, mid-tail, and long-tail phrases with clear user intent grounded in this app context.",
    "5. Exclude junk, release-note phrasing, unrelated broad terms, and competitor-brand phrases.",
    "6. Keep each keyword phrase natural and human-searchable, with a maximum of 8 words.",
  ];

  return blocks.filter(Boolean).join("\n");
}
