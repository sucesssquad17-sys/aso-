export type DiscoveryGenerationMode = "ai-first" | "local-fallback";

export function isUsableDiscoveryKeywordOutput(
  keywordCount: number,
  minimumUsableCount: number,
) {
  return keywordCount >= minimumUsableCount;
}

export function finalizeDiscoveryKeywordPool(input: {
  modelKeywords: string[];
  fallbackKeywords: string[];
  poolLimit: number;
}) {
  if (input.modelKeywords.length > 0) {
    return {
      keywords: input.modelKeywords.slice(0, input.poolLimit),
      generationMode: "ai-first" as const,
      localFallbackCount: 0,
    };
  }

  return {
    keywords: input.fallbackKeywords.slice(0, input.poolLimit),
    generationMode: "local-fallback" as const,
    localFallbackCount: Math.min(input.fallbackKeywords.length, input.poolLimit),
  };
}
