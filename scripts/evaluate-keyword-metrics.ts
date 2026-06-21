import assert from "node:assert/strict";
import {
  addTokenWeights,
  addWeightedTerm,
  collectTitleSegments,
  createMetricEstimator,
  deriveCategoryHints,
  tokenize,
  type KeywordContext,
  type KeywordMarketSample,
} from "../src/lib/keywordMetrics";

function buildSignalContext(
  context: KeywordContext,
  competitorWeights: Record<string, number>,
) {
  const candidateWeights = new Map<string, number>();
  collectTitleSegments(context.title).forEach((segment, index) => {
    addWeightedTerm(candidateWeights, segment, 40 - (index * 4));
  });
  addTokenWeights(candidateWeights, context.title, 16, 20);
  addTokenWeights(candidateWeights, context.description, 2, 5);
  deriveCategoryHints(context.category).forEach((hint) => {
    addWeightedTerm(candidateWeights, hint, 12);
  });
  tokenize(context.developer).forEach((token) => {
    addWeightedTerm(candidateWeights, token, 2);
  });

  const competitorWeightMap = new Map<string, number>();
  Object.entries(competitorWeights).forEach(([term, weight]) => {
    competitorWeightMap.set(term, weight);
    addWeightedTerm(candidateWeights, term, Math.max(4, Math.round(weight / 2)));
  });

  return {
    candidateWeights,
    competitorWeights: competitorWeightMap,
  };
}

function buildMarketSamples(samples: KeywordMarketSample[]) {
  return new Map(samples.map((sample) => [sample.keyword, sample]));
}

const financeContext: KeywordContext = {
  title: "Nova Budget Planner",
  description:
    "Track spending, manage expenses, plan monthly budgets, and monitor personal finance goals.",
  category: "Finance",
  developer: "Nova Labs",
  store: "android",
  country: "us",
};

const financeEstimator = createMetricEstimator(
  financeContext,
  buildSignalContext(financeContext, {
    budget: 90,
    "budget planner": 75,
    "expense tracker": 72,
    "money tracker": 61,
    ynab: 84,
    finance: 38,
  }),
  buildMarketSamples([
    {
      keyword: "budget",
      resultCount: 10,
      resultDensity: 1,
      exactPhraseRate: 0.2,
      prefixPhraseRate: 0.5,
      titleTokenSaturation: 0.92,
      categoryConsistency: 0.9,
      firstTokenDominance: 0.48,
      genericSpread: 0.88,
      repeatedPhraseRate: 0.7,
      popularityScore: 0.82,
      publisherDiversity: 0.9,
      titleDiversity: 0.86,
      categoryDiversity: 0.74,
      topResultDominance: 0.24,
      detailCoverage: 1,
      resultNoise: 0.08,
    },
    {
      keyword: "budget planner",
      resultCount: 10,
      resultDensity: 1,
      exactPhraseRate: 0.1,
      prefixPhraseRate: 0.35,
      titleTokenSaturation: 0.76,
      categoryConsistency: 0.92,
      firstTokenDominance: 0.34,
      genericSpread: 0.74,
      repeatedPhraseRate: 0.52,
      popularityScore: 0.74,
      publisherDiversity: 0.88,
      titleDiversity: 0.81,
      categoryDiversity: 0.69,
      topResultDominance: 0.3,
      detailCoverage: 1,
      resultNoise: 0.12,
    },
    {
      keyword: "expense tracker",
      resultCount: 10,
      resultDensity: 1,
      exactPhraseRate: 0.08,
      prefixPhraseRate: 0.24,
      titleTokenSaturation: 0.71,
      categoryConsistency: 0.95,
      firstTokenDominance: 0.28,
      genericSpread: 0.61,
      repeatedPhraseRate: 0.43,
      popularityScore: 0.68,
      publisherDiversity: 0.84,
      titleDiversity: 0.78,
      categoryDiversity: 0.63,
      topResultDominance: 0.34,
      detailCoverage: 0.67,
      resultNoise: 0.15,
    },
    {
      keyword: "shared family budget planner",
      resultCount: 8,
      resultDensity: 0.8,
      exactPhraseRate: 0,
      prefixPhraseRate: 0.04,
      titleTokenSaturation: 0.42,
      categoryConsistency: 0.85,
      firstTokenDominance: 0.18,
      genericSpread: 0.31,
      repeatedPhraseRate: 0.12,
      popularityScore: 0.41,
      publisherDiversity: 0.72,
      titleDiversity: 0.76,
      categoryDiversity: 0.58,
      topResultDominance: 0.36,
      detailCoverage: 0.33,
      resultNoise: 0.22,
    },
    {
      keyword: "nova budget planner",
      resultCount: 5,
      resultDensity: 0.5,
      exactPhraseRate: 0.02,
      prefixPhraseRate: 0.08,
      titleTokenSaturation: 0.37,
      categoryConsistency: 0.9,
      firstTokenDominance: 0.62,
      genericSpread: 0.14,
      repeatedPhraseRate: 0.08,
      popularityScore: 0.36,
      publisherDiversity: 0.38,
      titleDiversity: 0.42,
      categoryDiversity: 0.31,
      topResultDominance: 0.58,
      detailCoverage: 0.67,
      resultNoise: 0.1,
    },
    {
      keyword: "ynab",
      resultCount: 7,
      resultDensity: 0.7,
      exactPhraseRate: 0.21,
      prefixPhraseRate: 0.4,
      titleTokenSaturation: 0.33,
      categoryConsistency: 0.9,
      firstTokenDominance: 0.81,
      genericSpread: 0.08,
      repeatedPhraseRate: 0.26,
      popularityScore: 0.92,
      publisherDiversity: 0.28,
      titleDiversity: 0.33,
      categoryDiversity: 0.22,
      topResultDominance: 0.84,
      detailCoverage: 1,
      resultNoise: 0.04,
    },
    {
      keyword: "photo editor",
      resultCount: 10,
      resultDensity: 1,
      exactPhraseRate: 0.18,
      prefixPhraseRate: 0.42,
      titleTokenSaturation: 0.81,
      categoryConsistency: 0.06,
      firstTokenDominance: 0.4,
      genericSpread: 0.78,
      repeatedPhraseRate: 0.56,
      popularityScore: 0.71,
      publisherDiversity: 0.91,
      titleDiversity: 0.87,
      categoryDiversity: 0.83,
      topResultDominance: 0.26,
      detailCoverage: 1,
      resultNoise: 0.69,
    },
  ]),
);

const financeResults = [
  financeEstimator("budget"),
  financeEstimator("budget planner"),
  financeEstimator("expense tracker"),
  financeEstimator("shared family budget planner"),
  financeEstimator("nova budget planner"),
  financeEstimator("photo editor"),
];

const budget = financeResults.find((entry) => entry.keyword === "budget")!;
const budgetPlanner = financeResults.find((entry) => entry.keyword === "budget planner")!;
const expenseTracker = financeResults.find((entry) => entry.keyword === "expense tracker")!;
const longTail = financeResults.find((entry) => entry.keyword === "shared family budget planner")!;
const branded = financeResults.find((entry) => entry.keyword === "nova budget planner")!;
const competitorBrand = financeEstimator("ynab");
const unrelated = financeResults.find((entry) => entry.keyword === "photo editor")!;
const sparseHeuristic = financeEstimator("wallpaper hd stickers");

assert.ok(expenseTracker.relevance > unrelated.relevance);
assert.ok(branded.relevance >= budgetPlanner.relevance);
assert.ok(budget.demand > longTail.demand);
assert.ok(budget.difficulty > longTail.difficulty);
assert.ok(branded.demand >= budgetPlanner.demand);
assert.ok(competitorBrand.relevance < budgetPlanner.relevance);
assert.ok(competitorBrand.difficulty >= 80);
assert.equal(budget.volume, budget.demand);
assert.notEqual(budget.confidence, "low");
assert.equal(sparseHeuristic.confidence, "low");

const prayerContext: KeywordContext = {
  title: "Prayer Sleep Stories",
  description:
    "Guided nightly prayer, calm audio devotionals, christian meditation, and bedtime reflections.",
  category: "Health & Fitness",
  developer: "Still Water Studio",
  store: "ios",
  country: "us",
};

const prayerEstimator = createMetricEstimator(
  prayerContext,
  buildSignalContext(prayerContext, {
    prayer: 82,
    "sleep prayer": 64,
    "daily prayer": 58,
    meditation: 36,
  }),
  buildMarketSamples([
    {
      keyword: "prayer",
      resultCount: 10,
      resultDensity: 1,
      exactPhraseRate: 0.12,
      prefixPhraseRate: 0.44,
      titleTokenSaturation: 0.83,
      categoryConsistency: 0.63,
      firstTokenDominance: 0.47,
      genericSpread: 0.82,
      repeatedPhraseRate: 0.64,
      popularityScore: 0.73,
      publisherDiversity: 0.86,
      titleDiversity: 0.8,
      categoryDiversity: 0.68,
      topResultDominance: 0.29,
      detailCoverage: 1,
      resultNoise: 0.14,
    },
    {
      keyword: "sleep prayer",
      resultCount: 8,
      resultDensity: 0.8,
      exactPhraseRate: 0.05,
      prefixPhraseRate: 0.18,
      titleTokenSaturation: 0.58,
      categoryConsistency: 0.72,
      firstTokenDominance: 0.22,
      genericSpread: 0.39,
      repeatedPhraseRate: 0.25,
      popularityScore: 0.49,
      publisherDiversity: 0.77,
      titleDiversity: 0.72,
      categoryDiversity: 0.61,
      topResultDominance: 0.35,
      detailCoverage: 0.67,
      resultNoise: 0.18,
    },
    {
      keyword: "guided nightly prayer",
      resultCount: 7,
      resultDensity: 0.7,
      exactPhraseRate: 0.01,
      prefixPhraseRate: 0.04,
      titleTokenSaturation: 0.34,
      categoryConsistency: 0.77,
      firstTokenDominance: 0.16,
      genericSpread: 0.24,
      repeatedPhraseRate: 0.1,
      popularityScore: 0.32,
      publisherDiversity: 0.69,
      titleDiversity: 0.74,
      categoryDiversity: 0.58,
      topResultDominance: 0.38,
      detailCoverage: 0.33,
      resultNoise: 0.21,
    },
  ]),
);

const prayer = prayerEstimator("prayer");
const sleepPrayer = prayerEstimator("sleep prayer");
const guidedNightlyPrayer = prayerEstimator("guided nightly prayer");

assert.ok(prayer.demand > guidedNightlyPrayer.demand);
assert.ok(prayer.difficulty > guidedNightlyPrayer.difficulty);
assert.ok(sleepPrayer.relevance > guidedNightlyPrayer.relevance);
assert.equal(prayer.volume, prayer.demand);

console.table([...financeResults, competitorBrand, sparseHeuristic]);
console.table([prayer, sleepPrayer, guidedNightlyPrayer]);
console.log("Keyword metrics fixture evaluation passed.");
