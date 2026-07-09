export type StoreType = "android" | "ios";

export type KeywordContext = {
  title: string;
  description?: string;
  category?: string;
  developer?: string;
  store?: StoreType;
  country?: string;
};

export type KeywordSignalContext = {
  candidateWeights?: Map<string, number>;
  competitorWeights?: Map<string, number>;
};

export type KeywordMarketSample = {
  keyword: string;
  resultCount: number;
  resultDensity: number;
  exactPhraseRate: number;
  prefixPhraseRate: number;
  titleTokenSaturation: number;
  categoryConsistency: number;
  firstTokenDominance: number;
  genericSpread: number;
  repeatedPhraseRate: number;
  popularityScore?: number;
  publisherDiversity?: number;
  titleDiversity?: number;
  categoryDiversity?: number;
  topResultDominance?: number;
  detailCoverage?: number;
  resultNoise?: number;
};

export type MetricConfidence = "low" | "medium" | "high";

export type KeywordIntentType =
  | "OWN_BRAND"
  | "CORE_TITLE_TOKEN"
  | "PARENT_BRAND"
  | "BRAND_MODIFIER_WEAK"
  | "COMPETITOR_BRAND"
  | "GENERIC_HEAD"
  | "GENERIC_MIDTAIL"
  | "LONG_TAIL"
  | "NEAR_BRAND_JUNK"
  | "LOW_INTENT_JUNK";

export type KeywordFeatureVector = {
  keyword: string;
  normalized: string;
  tokenCount: number;
  exactTitleMatch: number;
  exactTitleSegment: number;
  orderedTitleCoverage: number;
  titleCoverage: number;
  appTitleCoverage: number;
  descriptionCoverage: number;
  categoryCoverage: number;
  semanticCoverage: number;
  categorySemanticCoverage: number;
  brandCoverage: number;
  developerCoverage: number;
  weakModifierCoverage: number;
  genericCoverage: number;
  sourceStrength: number;
  competitionStrength: number;
  marketResultDensity: number;
  marketExactPhraseRate: number;
  marketPrefixPhraseRate: number;
  marketTitleTokenSaturation: number;
  marketCategoryConsistency: number;
  marketFirstTokenDominance: number;
  marketGenericSpread: number;
  marketRepeatedPhraseRate: number;
  marketPopularityScore: number;
  marketPublisherDiversity: number;
  marketTitleDiversity: number;
  marketCategoryDiversity: number;
  marketTopResultDominance: number;
  marketDetailCoverage: number;
  marketResultNoise: number;
  isLongTail: number;
  isTwoWord: number;
  isSingleWord: number;
  fullyBranded: number;
  mostlyGeneric: number;
  intentType: KeywordIntentType;
};

export type MetricEstimate = {
  keyword: string;
  demand: number;
  volume: number;
  difficulty: number;
  relevance: number;
  confidence: MetricConfidence;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "app", "apps", "best", "build", "by", "can", "create", "do",
  "for", "from", "get", "has", "have", "helps", "how", "in", "into", "is", "isn", "it",
  "make", "more", "new", "of", "on", "or", "our", "out", "that", "the", "this",
  "to", "up", "use", "using", "with", "you", "your", "about", "again", "but",
  "com", "covered", "download", "give", "giv", "http", "https", "isnt", "legal",
  "link", "now", "press", "term", "upload", "www",
]);

const WEAK_MODIFIER_TERMS = new Set([
  "across", "contact", "customer", "fix", "guide", "help", "issue", "phone",
  "problem", "security", "support", "vary", "what",
]);

const JUNK_MODIFIER_TERMS = new Set([
  "adapt", "again", "about", "covered", "download", "giv", "http", "https",
  "isn", "legal", "now", "press", "term", "upload", "www",
]);

const ALLOWED_VARIANT_TERMS = new Set([
  "beta", "canary", "dating", "dev", "game", "master", "personality",
]);

export const HIGH_VOLUME_TERMS = new Set([
  "ai", "app", "budget", "business", "calculator", "calendar", "camera", "chat",
  "crypto", "dating", "design", "editor", "email", "english", "finance", "fitness",
  "food", "game", "health", "invoice", "jobs", "kids", "learning", "meditation",
  "money", "music", "notes", "photo", "planner", "podcast", "productivity", "quiz",
  "recipe", "scanner", "sharing", "shopping", "sleep", "social", "study", "timer",
  "tracker", "travel", "update", "video", "vpn", "wallet", "weather", "weight",
  "workout", "platform", "network", "media", "interaction", "discovery", "community",
]);

const CATEGORY_HINTS: Record<string, string[]> = {
  finance: ["budget", "expense", "money", "tracker", "wallet", "investing"],
  productivity: ["planner", "tasks", "notes", "calendar", "organizer"],
  lifestyle: ["habit", "routine", "daily", "planner", "tracker"],
  health: ["fitness", "workout", "weight", "health", "tracker"],
  education: ["learn", "study", "quiz", "flashcards", "english"],
  business: ["invoice", "sales", "crm", "analytics", "manager"],
  utilities: ["scanner", "cleaner", "toolkit", "converter", "calculator"],
  photo: ["camera", "editor", "filters", "collage", "gallery"],
  video: ["editor", "maker", "player", "streaming", "shorts"],
  social: ["chat", "messenger", "community", "friends", "social"],
  travel: ["booking", "trip", "planner", "maps", "travel"],
};

const SEMANTIC_GROUPS = [
  ["budget", "expense", "spending", "money", "finance", "wallet", "saving", "savings", "subscription"],
  ["tracker", "tracking", "track", "monitor", "rank", "ranking", "analytics", "analysis", "insight"],
  ["keyword", "search", "aso", "seo", "optimization", "optimize", "visibility", "store", "discovery"],
  ["planner", "plan", "planning", "organizer", "schedule", "routine"],
  ["bible", "scripture", "verse", "devotional", "prayer", "christian", "holy", "gospel"],
  ["audio", "listen", "voice", "podcast", "sound", "music"],
  ["photo", "image", "picture", "camera", "editor", "editing", "filter", "gallery"],
  ["fitness", "workout", "health", "weight", "exercise", "training"],
  ["sleep", "meditation", "calm", "relax", "mindfulness"],
  ["task", "todo", "note", "calendar", "productivity"],
];

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeyword(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .join(" ");
}

function singularize(token: string) {
  if (token.length <= 4) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("sses") || token.endsWith("ics")) return token;
  if (token.endsWith("es")) return token.slice(0, -2);
  if (token.endsWith("ss")) return token;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function isUsefulToken(token: string) {
  return token.length > 2 && !STOP_WORDS.has(token);
}

export function tokenize(value?: string) {
  if (!value) return [];
  return normalizeText(value)
    .split(" ")
    .map(singularize)
    .filter(isUsefulToken);
}

export function collectTitleSegments(title: string) {
  return title
    .split(/[-:|()]/)
    .map((segment) => normalizeKeyword(segment))
    .filter(Boolean)
    .filter((segment) => segment.split(" ").length <= 2);
}

export function addWeightedTerm(
  target: Map<string, number>,
  rawTerm: string,
  weight: number,
) {
  if (weight <= 0) return;
  const term = normalizeKeyword(rawTerm);
  if (!term) return;
  const parts = term.split(" ");
  if (parts.length > 2) return;
  if (parts.some((part) => !isUsefulToken(part))) return;
  target.set(term, (target.get(term) || 0) + weight);
}

export function addTokenWeights(
  target: Map<string, number>,
  text: string | undefined,
  unigramWeight: number,
  bigramWeight: number,
) {
  const tokens = tokenize(text);
  for (const token of tokens) {
    addWeightedTerm(target, token, unigramWeight);
  }

  for (let i = 0; i < tokens.length - 1; i += 1) {
    addWeightedTerm(target, `${tokens[i]} ${tokens[i + 1]}`, bigramWeight);
  }
}

export function deriveCategoryHints(category?: string) {
  const normalized = normalizeText(category || "");
  if (!normalized) return [];

  const hints = new Set<string>();
  for (const [key, values] of Object.entries(CATEGORY_HINTS)) {
    if (normalized.includes(key)) {
      values.forEach((value) => hints.add(value));
    }
  }

  tokenize(category).forEach((token) => hints.add(token));
  return Array.from(hints);
}

export function getSortedCandidateTerms(
  candidateWeights: Map<string, number>,
  ownTitleTokens: Set<string>,
) {
  return Array.from(candidateWeights.entries())
    .filter(([term]) => {
      const parts = term.split(" ");
      const nonBrandParts = parts.filter((part) => !ownTitleTokens.has(part));
      if (parts.length > 1 && new Set(parts).size !== parts.length) {
        return false;
      }
      if (
        parts.length === 1 &&
        !HIGH_VOLUME_TERMS.has(parts[0]) &&
        !ownTitleTokens.has(parts[0]) &&
        term.length < 4
      ) {
        return false;
      }
      if (parts.every((part) => JUNK_MODIFIER_TERMS.has(part))) {
        return false;
      }
      if (
        nonBrandParts.length > 0 &&
        nonBrandParts.every((part) => WEAK_MODIFIER_TERMS.has(part) || JUNK_MODIFIER_TERMS.has(part)) &&
        !nonBrandParts.some((part) => ALLOWED_VARIANT_TERMS.has(part))
      ) {
        return false;
      }
      if (
        parts.length === 2 &&
        nonBrandParts.length === 1 &&
        nonBrandParts[0] &&
        JUNK_MODIFIER_TERMS.has(nonBrandParts[0])
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const scoreCandidate = ([term, weight]: [string, number]) => {
        const parts = term.split(" ");
        const nonGenericParts = parts.filter((part) => !HIGH_VOLUME_TERMS.has(part));
        const headPenalty =
          parts.length === 1 && HIGH_VOLUME_TERMS.has(parts[0]) ? 4 : 0;
        const specificityBonus =
          Math.min(6, nonGenericParts.length * 2) +
          (parts.length >= 2 ? 3 : 0) +
          (parts.length >= 3 ? 2 : 0);
        return weight + specificityBonus - headPenalty;
      };

      const scoreDelta = scoreCandidate(b) - scoreCandidate(a);
      if (scoreDelta !== 0) return scoreDelta;
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    });
}

function computeCoverage(tokens: string[], target: Set<string>) {
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const token of tokens) {
    if (target.has(token)) {
      hits += 1;
    }
  }
  return hits / tokens.length;
}

function mapSemanticConcepts(tokens: string[]) {
  const concepts = new Set<string>();

  SEMANTIC_GROUPS.forEach((group, index) => {
    if (group.some((token) => tokens.includes(token))) {
      concepts.add(`group:${index}`);
    }
  });

  return concepts;
}

function computeConceptCoverage(concepts: Set<string>, target: Set<string>) {
  if (concepts.size === 0 || target.size === 0) return 0;
  let hits = 0;
  concepts.forEach((concept) => {
    if (target.has(concept)) {
      hits += 1;
    }
  });
  return hits / concepts.size;
}

function computeOrderedCoverage(tokens: string[], titleTokens: string[]) {
  if (tokens.length === 0 || titleTokens.length === 0) return 0;
  let bestRun = 0;

  for (let titleIndex = 0; titleIndex < titleTokens.length; titleIndex += 1) {
    let run = 0;
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      if (titleTokens[titleIndex + tokenIndex] === tokens[tokenIndex]) {
        run += 1;
        bestRun = Math.max(bestRun, run);
      } else {
        break;
      }
    }
  }

  return bestRun / tokens.length;
}

function normalizeSignalWeight(weight: number, maxWeight: number) {
  if (maxWeight <= 0 || weight <= 0) return 0;
  return clamp(Math.log1p(weight) / Math.log1p(maxWeight), 0, 1);
}

function blendWeighted(parts: Array<[number, number]>) {
  let weighted = 0;
  let totalWeight = 0;
  for (const [value, weight] of parts) {
    if (weight <= 0) continue;
    weighted += value * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) return 0;
  return clamp(weighted / totalWeight, 0, 1);
}

function piecewiseScore(unit: number) {
  const value = clamp(unit, 0, 1);
  if (value <= 0.15) return Math.round(5 + (value / 0.15) * 15);
  if (value <= 0.35) return Math.round(20 + ((value - 0.15) / 0.2) * 20);
  if (value <= 0.6) return Math.round(40 + ((value - 0.35) / 0.25) * 20);
  if (value <= 0.82) return Math.round(60 + ((value - 0.6) / 0.22) * 20);
  return Math.round(80 + ((value - 0.82) / 0.18) * 20);
}

function remapScoreForDisplay(rawScore: number) {
  const clamped = clamp(rawScore, 5, 100);
  const displayScore = 51 + (((clamped - 5) / 95) * 49);
  return clamp(Math.round(displayScore), 51, 100);
}

function getQueryShapeDemand(genericCoverage: number, tokenCount: number) {
  if (tokenCount <= 1) return clamp(0.75 + (genericCoverage * 0.2), 0, 1);
  if (tokenCount === 2) return clamp(0.6 + (genericCoverage * 0.2), 0, 1);
  if (tokenCount === 3) return clamp(0.45 + (genericCoverage * 0.15), 0, 1);
  return clamp(0.25 + (genericCoverage * 0.1), 0, 1);
}

function computeWeakModifierCoverage(tokens: string[], brandTokens: Set<string>) {
  const nonBrandTokens = tokens.filter((token) => !brandTokens.has(token));
  if (nonBrandTokens.length === 0) return 0;

  let weakModifierCount = 0;
  nonBrandTokens.forEach((token) => {
    if (WEAK_MODIFIER_TERMS.has(token)) {
      weakModifierCount += 1;
    }
  });

  return weakModifierCount / nonBrandTokens.length;
}

function classifyKeywordIntent(
  features: Pick<
    KeywordFeatureVector,
    | "tokenCount"
    | "exactTitleMatch"
    | "exactTitleSegment"
    | "orderedTitleCoverage"
    | "titleCoverage"
    | "appTitleCoverage"
    | "descriptionCoverage"
    | "categoryCoverage"
    | "semanticCoverage"
    | "categorySemanticCoverage"
    | "brandCoverage"
    | "developerCoverage"
    | "weakModifierCoverage"
    | "genericCoverage"
    | "competitionStrength"
    | "marketTopResultDominance"
    | "marketResultNoise"
    | "isLongTail"
    | "isSingleWord"
  >,
) : KeywordIntentType {
  const clearOwnBrand =
    features.exactTitleMatch > 0 ||
    features.exactTitleSegment > 0 ||
    (features.orderedTitleCoverage >= 0.999 && features.appTitleCoverage >= 0.999);

  if (clearOwnBrand) {
    return "OWN_BRAND";
  }

  const coreTitleToken =
    features.tokenCount === 1 &&
    features.titleCoverage >= 0.999 &&
    features.developerCoverage < 0.5;

  if (coreTitleToken) {
    return "CORE_TITLE_TOKEN";
  }

  const parentBrand =
    features.tokenCount === 1 &&
    features.titleCoverage > 0 &&
    features.developerCoverage >= 0.999;

  if (parentBrand) {
    return "PARENT_BRAND";
  }

  const weakBrandModifier =
    features.brandCoverage > 0 &&
    features.appTitleCoverage < 0.999 &&
    features.weakModifierCoverage >= 0.5 &&
    features.semanticCoverage < 0.6 &&
    features.categorySemanticCoverage < 0.55 &&
    features.genericCoverage < 0.4;

  if (weakBrandModifier) {
    return "BRAND_MODIFIER_WEAK";
  }

  const nearBrandJunk =
    features.titleCoverage > 0 &&
    features.titleCoverage < 1 &&
    features.appTitleCoverage < 0.999 &&
    features.orderedTitleCoverage <= 0.5 &&
    features.semanticCoverage < 0.5 &&
    features.categorySemanticCoverage < 0.5 &&
    features.categoryCoverage < 0.5;

  if (nearBrandJunk) {
    return "NEAR_BRAND_JUNK";
  }

  const competitorBrand =
    features.competitionStrength >= 0.5 &&
    features.brandCoverage < 0.5 &&
    features.titleCoverage < 0.5 &&
    features.marketTopResultDominance >= 0.35;

  if (competitorBrand) {
    return "COMPETITOR_BRAND";
  }

  const lowIntentJunk =
    features.semanticCoverage < 0.25 &&
    features.categorySemanticCoverage < 0.25 &&
    features.categoryCoverage < 0.25 &&
    features.brandCoverage < 0.25 &&
    features.genericCoverage < 0.25 &&
    features.marketResultNoise > 0.58;

  if (lowIntentJunk) {
    return "LOW_INTENT_JUNK";
  }

  if (features.isLongTail > 0) {
    return "LONG_TAIL";
  }

  if (features.isSingleWord > 0 && features.genericCoverage >= 0.35) {
    return "GENERIC_HEAD";
  }

  return "GENERIC_MIDTAIL";
}

function confidenceFromScore(score: number): MetricConfidence {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function extractKeywordFeatures(
  context: KeywordContext,
  keyword: string,
  signalContext?: KeywordSignalContext,
  marketSample?: KeywordMarketSample,
): KeywordFeatureVector {
  const normalized = normalizeKeyword(keyword);
  const tokens = tokenize(keyword);
  const tokenCount = tokens.length || 1;
  const normalizedTitle = normalizeKeyword(context.title);
  const titleTokensList = tokenize(context.title);
  const titleTokens = new Set(titleTokensList);
  const descriptionTokens = new Set(tokenize(context.description));
  const categoryTokenList = [
    ...tokenize(context.category),
    ...deriveCategoryHints(context.category).flatMap((hint) => tokenize(hint)),
  ];
  const categoryTokens = new Set(categoryTokenList);
  const titleConcepts = mapSemanticConcepts(titleTokensList);
  const descriptionConcepts = mapSemanticConcepts(Array.from(descriptionTokens));
  const categoryConcepts = mapSemanticConcepts(categoryTokenList);
  const brandTokens = new Set(tokenize(collectTitleSegments(context.title).join(" ")));
  const developerTokens = new Set(tokenize(context.developer));
  const titleSegments = new Set(collectTitleSegments(context.title));
  const candidateWeights = signalContext?.candidateWeights || new Map<string, number>();
  const competitorWeights = signalContext?.competitorWeights || new Map<string, number>();
  const maxCandidateWeight = Math.max(1, ...candidateWeights.values());
  const maxCompetitorWeight = Math.max(1, ...competitorWeights.values());

  const titleCoverage = computeCoverage(tokens, titleTokens);
  const appTitleCoverage =
    titleTokensList.length > 0
      ? tokens.filter((token) => titleTokens.has(token)).length / titleTokensList.length
      : 0;
  const orderedTitleCoverage = computeOrderedCoverage(tokens, titleTokensList);
  const descriptionCoverage = computeCoverage(tokens, descriptionTokens);
  const categoryCoverage = computeCoverage(tokens, categoryTokens);
  const keywordConcepts = mapSemanticConcepts(tokens);
  const semanticCoverage = Math.max(
    computeConceptCoverage(keywordConcepts, titleConcepts),
    computeConceptCoverage(keywordConcepts, descriptionConcepts),
  );
  const categorySemanticCoverage = computeConceptCoverage(keywordConcepts, categoryConcepts);
  const brandCoverage = computeCoverage(tokens, brandTokens);
  const developerCoverage = computeCoverage(tokens, developerTokens);
  const weakModifierCoverage = computeWeakModifierCoverage(tokens, brandTokens);
  const genericCoverage = computeCoverage(tokens, HIGH_VOLUME_TERMS);
  const exactTitleMatch = normalizedTitle === normalized ? 1 : 0;
  const exactTitleSegment = titleSegments.has(normalized) ? 1 : 0;
  const candidateWeight = candidateWeights.get(normalized) || 0;
  const competitorWeight = competitorWeights.get(normalized) || 0;

  const provisionalFeatures = {
    tokenCount,
    exactTitleMatch,
    exactTitleSegment,
    orderedTitleCoverage,
    titleCoverage,
    appTitleCoverage,
    descriptionCoverage,
    categoryCoverage,
    semanticCoverage,
    categorySemanticCoverage,
    brandCoverage,
    developerCoverage,
    weakModifierCoverage,
    genericCoverage,
    competitionStrength: normalizeSignalWeight(competitorWeight, maxCompetitorWeight),
    marketTopResultDominance: marketSample?.topResultDominance || 0,
    marketResultNoise: marketSample?.resultNoise || 0,
    isLongTail: tokenCount >= 3 ? 1 : 0,
    isSingleWord: tokenCount === 1 ? 1 : 0,
  };
  const intentType = classifyKeywordIntent(provisionalFeatures);

  return {
    keyword,
    normalized,
    tokenCount,
    exactTitleMatch,
    exactTitleSegment,
    orderedTitleCoverage,
    titleCoverage,
    appTitleCoverage,
    descriptionCoverage,
    categoryCoverage,
    semanticCoverage,
    categorySemanticCoverage,
    brandCoverage,
    developerCoverage,
    weakModifierCoverage,
    genericCoverage,
    sourceStrength: normalizeSignalWeight(candidateWeight, maxCandidateWeight),
    competitionStrength: normalizeSignalWeight(competitorWeight, maxCompetitorWeight),
    marketResultDensity: marketSample?.resultDensity || 0,
    marketExactPhraseRate: marketSample?.exactPhraseRate || 0,
    marketPrefixPhraseRate: marketSample?.prefixPhraseRate || 0,
    marketTitleTokenSaturation: marketSample?.titleTokenSaturation || 0,
    marketCategoryConsistency: marketSample?.categoryConsistency || 0,
    marketFirstTokenDominance: marketSample?.firstTokenDominance || 0,
    marketGenericSpread: marketSample?.genericSpread || 0,
    marketRepeatedPhraseRate: marketSample?.repeatedPhraseRate || 0,
    marketPopularityScore: marketSample?.popularityScore || 0,
    marketPublisherDiversity: marketSample?.publisherDiversity || 0,
    marketTitleDiversity: marketSample?.titleDiversity || 0,
    marketCategoryDiversity: marketSample?.categoryDiversity || 0,
    marketTopResultDominance: marketSample?.topResultDominance || 0,
    marketDetailCoverage: marketSample?.detailCoverage || 0,
    marketResultNoise: marketSample?.resultNoise || 0,
    isLongTail: tokenCount >= 3 ? 1 : 0,
    isTwoWord: tokenCount === 2 ? 1 : 0,
    isSingleWord: tokenCount === 1 ? 1 : 0,
    fullyBranded: brandCoverage >= 0.999 ? 1 : 0,
    mostlyGeneric: genericCoverage >= 0.66 ? 1 : 0,
    intentType,
  };
}

export function scoreKeywordMetrics(features: KeywordFeatureVector): MetricEstimate {
  const genericMismatchPenalty = clamp(
    features.genericCoverage - Math.max(features.titleCoverage, features.brandCoverage),
    0,
    1,
  );
  const genericSemanticPenalty = clamp(
    features.genericCoverage *
      (1 - Math.max(features.titleCoverage, features.appTitleCoverage)) *
      Math.max(features.semanticCoverage, features.categorySemanticCoverage),
    0,
    1,
  );
  const weakModifierPenalty = clamp(
    features.weakModifierCoverage *
      (1 - Math.max(
        features.semanticCoverage,
        features.categorySemanticCoverage,
        features.categoryCoverage,
        features.genericCoverage,
      )),
    0,
    1,
  );
  const partialBrandPenalty = clamp(
    features.brandCoverage *
      (1 - features.appTitleCoverage) *
      (1 - Math.max(features.exactTitleMatch, features.exactTitleSegment)),
    0,
    1,
  );

  const relevanceUnit = clamp(
    blendWeighted([
      [features.exactTitleMatch, 1.2],
      [features.exactTitleSegment, 1],
      [features.orderedTitleCoverage, 0.92],
      [features.titleCoverage, 0.72],
      [features.appTitleCoverage, 0.62],
      [features.semanticCoverage, 0.88],
      [features.brandCoverage, 0.16],
      [features.categoryCoverage, 0.4],
      [features.categorySemanticCoverage, 0.35],
      [features.descriptionCoverage, 0.25],
      [features.sourceStrength, 0.24],
      [features.marketCategoryConsistency, 0.2],
    ]) -
      (genericMismatchPenalty * 0.2) -
      (genericSemanticPenalty * 0.18) -
      (weakModifierPenalty * 0.3) -
      (partialBrandPenalty * 0.14),
    0,
    1,
  );

  const queryShapeDemand = getQueryShapeDemand(features.genericCoverage, features.tokenCount);
  const resultBreadth = clamp(
    blendWeighted([
      [features.marketResultDensity, 0.2],
      [features.marketTitleDiversity, 0.2],
      [features.marketPublisherDiversity, 0.18],
      [features.marketCategoryDiversity, 0.12],
      [features.marketGenericSpread, 0.18],
      [1 - features.marketTopResultDominance, 0.12],
    ]),
    0,
    1,
  );
  const titlePresenceAcrossResults = clamp(
    blendWeighted([
      [features.marketExactPhraseRate, 0.4],
      [features.marketPrefixPhraseRate, 0.28],
      [features.marketRepeatedPhraseRate, 0.32],
    ]),
    0,
    1,
  );
  const categoryDemand = clamp(
    blendWeighted([
      [features.marketCategoryDiversity, 0.5],
      [features.marketCategoryConsistency, 0.5],
    ]),
    0,
    1,
  );
  const genericIntentStrength = clamp(
    blendWeighted([
      [features.genericCoverage, 0.7],
      [features.isSingleWord, 0.2],
      [features.isTwoWord, 0.1],
    ]),
    0,
    1,
  );
  let demandUnit = clamp(
    (queryShapeDemand * 0.25) +
      (resultBreadth * 0.2) +
      (features.marketPopularityScore * 0.2) +
      (titlePresenceAcrossResults * 0.15) +
      (categoryDemand * 0.1) +
      (genericIntentStrength * 0.1),
    0,
    1,
  );

  if (features.isLongTail) demandUnit -= 0.15;
  if (features.fullyBranded) demandUnit -= 0.25;
  if (features.brandCoverage >= 0.999 && features.appTitleCoverage < 0.999) demandUnit -= 0.16;
  if (features.weakModifierCoverage >= 0.5) demandUnit -= 0.18;
  if (features.marketTopResultDominance > 0.75) demandUnit -= 0.15;
  if (features.marketResultNoise > 0.6) demandUnit -= 0.1;

  demandUnit = clamp(demandUnit, 0, 1);

  const difficultyUnit = clamp(
    (
      features.marketPopularityScore * 0.3 +
      Math.max(features.marketExactPhraseRate, features.marketPrefixPhraseRate) * 0.2 +
      features.marketTitleTokenSaturation * 0.15 +
      features.competitionStrength * 0.15 +
      features.marketResultDensity * 0.1 +
      features.genericCoverage * 0.1
    ) +
      (demandUnit * 0.12) -
      (features.isLongTail * 0.15) -
      (features.exactTitleMatch * 0.28) -
      (features.exactTitleSegment * 0.16) -
      (features.fullyBranded * 0.08),
    0,
    1,
  );

  const baseDemand = piecewiseScore(demandUnit);
  const baseDifficulty = piecewiseScore(difficultyUnit);
  const baseRelevance = piecewiseScore(relevanceUnit);

  let demand = baseDemand;
  let difficulty = baseDifficulty;
  let relevance = baseRelevance;

  switch (features.intentType) {
    case "OWN_BRAND":
      demand = Math.max(
        demand,
        80 + Math.round(features.marketPopularityScore * 16) + Math.round(resultBreadth * 4),
      );
      demand = Math.min(demand, 99);
      difficulty = Math.max(difficulty, 60);
      relevance = Math.max(relevance, 98);
      break;
    case "CORE_TITLE_TOKEN":
      demand = Math.max(
        demand,
        42 +
          Math.round(features.marketPopularityScore * 8) +
          Math.round(features.marketTitleTokenSaturation * 8),
      );
      demand = Math.min(demand, 68);
      difficulty = Math.max(
        difficulty,
        26 + Math.round(features.marketPopularityScore * 10),
      );
      relevance = Math.max(
        relevance,
        76 +
          Math.round(features.titleCoverage * 8) +
          Math.round(features.marketTitleTokenSaturation * 6),
      );
      relevance = Math.min(relevance, 92);
      break;
    case "PARENT_BRAND":
      demand = Math.min(
        demand,
        18 + Math.round(features.marketPopularityScore * 8) + Math.round(features.marketGenericSpread * 5),
      );
      difficulty = Math.max(
        difficulty,
        28 + Math.round(features.marketPopularityScore * 14),
      );
      relevance = Math.min(
        relevance,
        26 +
          Math.round(features.marketExactPhraseRate * 14) +
          Math.round(features.marketTitleTokenSaturation * 10),
      );
      break;
    case "BRAND_MODIFIER_WEAK":
      demand = Math.min(demand, 12 + Math.round(features.marketPopularityScore * 7));
      difficulty = Math.min(difficulty, 24);
      relevance = Math.min(
        relevance,
        12 +
          Math.round(features.titleCoverage * 14) +
          Math.round(features.marketPrefixPhraseRate * 8),
      );
      break;
    case "COMPETITOR_BRAND":
      demand = Math.max(demand, 60);
      difficulty = Math.max(difficulty, 85);
      relevance = Math.min(relevance, 40);
      break;
    case "NEAR_BRAND_JUNK":
      demand = Math.min(demand, 45);
      relevance = Math.min(relevance, 45);
      break;
    case "LOW_INTENT_JUNK":
      demand = Math.min(demand, 30);
      difficulty = Math.min(difficulty, 45);
      relevance = Math.min(relevance, 25);
      break;
    case "LONG_TAIL":
      demand = Math.min(demand, Math.max(18, demand));
      difficulty = Math.max(5, difficulty - 8);
      break;
    case "GENERIC_HEAD":
      demand = Math.max(demand, 68);
      difficulty = Math.max(difficulty, 62);
      break;
    case "GENERIC_MIDTAIL":
      demand = Math.max(demand, 42);
      break;
  }

  if (features.exactTitleMatch) {
    demand = Math.max(
      demand,
      85 + Math.round(features.marketPopularityScore * 10),
    );
    difficulty = Math.max(difficulty, features.marketResultDensity >= 0.6 ? 65 : 50);
    relevance = Math.max(relevance, 98);
  } else if (features.exactTitleSegment) {
    demand = Math.max(demand, 80 + Math.round(features.marketPopularityScore * 10));
    difficulty = Math.max(difficulty, 55);
    relevance = Math.max(relevance, 96);
  }

  if (
    features.isSingleWord &&
    features.brandCoverage >= 0.999 &&
    features.appTitleCoverage >= 0.999 &&
    features.marketResultDensity >= 0.5
  ) {
    demand = Math.max(demand, 30);
    difficulty = Math.max(difficulty, 34);
    relevance = Math.max(relevance, 58);
  }

  const hasStrongBrandIntentMatch =
    features.exactTitleMatch > 0 ||
    features.exactTitleSegment > 0 ||
    features.orderedTitleCoverage >= 0.75 ||
    (features.titleCoverage >= 0.75 && features.descriptionCoverage >= 0.35);
  const hasStrongSemanticIntentMatch =
    (
      features.semanticCoverage >= 0.85 ||
      features.categorySemanticCoverage >= 0.8
    ) &&
    Math.max(features.titleCoverage, features.appTitleCoverage, features.brandCoverage) >= 0.25;

  if (hasStrongBrandIntentMatch) {
    relevance = Math.max(relevance, features.isLongTail ? 48 : 58);
  } else if (hasStrongSemanticIntentMatch) {
    relevance = Math.max(relevance, features.isLongTail ? 42 : 48);
  }

  const isWeakPartialBrandPhrase =
    !features.exactTitleMatch &&
    !features.exactTitleSegment &&
    features.tokenCount >= 2 &&
    features.titleCoverage > 0 &&
    features.titleCoverage < 1 &&
    features.orderedTitleCoverage <= 0.5 &&
    features.semanticCoverage < 0.5 &&
    features.categorySemanticCoverage < 0.5 &&
    features.categoryCoverage < 0.5 &&
    features.marketExactPhraseRate < 0.08 &&
    features.marketPrefixPhraseRate < 0.12;

  if (isWeakPartialBrandPhrase) {
    demand = Math.min(demand, 24);
    difficulty = Math.min(difficulty, 26);
    relevance = Math.min(relevance, 34);
  }

  const confidenceScore = Math.round(
    (
      (features.marketResultDensity * 0.25) +
      (features.marketDetailCoverage * 0.22) +
      ((features.marketPopularityScore > 0 ? 1 : 0) * 0.13) +
      ((1 - features.marketResultNoise) * 0.18) +
      (Math.max(features.marketTitleTokenSaturation, features.marketCategoryConsistency) * 0.12) +
      (
        (features.intentType === "OWN_BRAND" ||
          features.intentType === "CORE_TITLE_TOKEN" ||
          features.intentType === "COMPETITOR_BRAND" ||
          features.intentType === "GENERIC_HEAD")
          ? 0.1
          : features.intentType === "PARENT_BRAND"
            ? 0.06
            : features.intentType === "BRAND_MODIFIER_WEAK"
              ? 0.03
          : features.intentType === "GENERIC_MIDTAIL" || features.intentType === "LONG_TAIL"
            ? 0.07
            : 0.04
      )
    ) * 100,
  );

  return {
    keyword: features.keyword,
    demand: remapScoreForDisplay(demand),
    volume: remapScoreForDisplay(demand),
    difficulty: remapScoreForDisplay(difficulty),
    relevance: remapScoreForDisplay(relevance),
    confidence: confidenceFromScore(confidenceScore),
  };
}

export function createMetricEstimator(
  context: KeywordContext,
  signalContext?: KeywordSignalContext,
  marketSamples?: Map<string, KeywordMarketSample>,
) {
  return (keyword: string): MetricEstimate => {
    const normalized = normalizeKeyword(keyword);
    const features = extractKeywordFeatures(
      context,
      keyword,
      signalContext,
      marketSamples?.get(normalized),
    );
    return scoreKeywordMetrics(features);
  };
}
