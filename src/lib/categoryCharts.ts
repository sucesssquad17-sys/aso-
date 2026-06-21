export type ChartStoreType = "android" | "ios";
export type ChartType = "free" | "paid" | "grossing";

export type ChartCategoryOption = {
  code: string;
  label: string;
  rawCode: string | number | null;
};

export type ChartEntry = {
  appId: string;
  title: string;
  developer: string;
  icon: string;
  store: ChartStoreType;
  country: string;
  category: string;
  chartType: ChartType;
  position: number;
  url?: string;
};

export const CHART_TYPE_OPTIONS: Array<{ value: ChartType; label: string }> = [
  { value: "free", label: "Top Free" },
  { value: "paid", label: "Top Paid" },
  { value: "grossing", label: "Top Grossing" },
];

const COMMON_ANDROID_CATEGORIES: ChartCategoryOption[] = [
  { code: "application", label: "All Apps", rawCode: "APPLICATION" },
  { code: "game", label: "Games", rawCode: "GAME" },
  { code: "business", label: "Business", rawCode: "BUSINESS" },
  { code: "communication", label: "Communication", rawCode: "COMMUNICATION" },
  { code: "education", label: "Education", rawCode: "EDUCATION" },
  { code: "entertainment", label: "Entertainment", rawCode: "ENTERTAINMENT" },
  { code: "finance", label: "Finance", rawCode: "FINANCE" },
  { code: "health-fitness", label: "Health & Fitness", rawCode: "HEALTH_AND_FITNESS" },
  { code: "lifestyle", label: "Lifestyle", rawCode: "LIFESTYLE" },
  { code: "music-audio", label: "Music & Audio", rawCode: "MUSIC_AND_AUDIO" },
  { code: "news-magazines", label: "News & Magazines", rawCode: "NEWS_AND_MAGAZINES" },
  { code: "photo-video", label: "Photo & Video", rawCode: "PHOTOGRAPHY" },
  { code: "productivity", label: "Productivity", rawCode: "PRODUCTIVITY" },
  { code: "shopping", label: "Shopping", rawCode: "SHOPPING" },
  { code: "social", label: "Social", rawCode: "SOCIAL" },
  { code: "sports", label: "Sports", rawCode: "SPORTS" },
  { code: "tools", label: "Tools", rawCode: "TOOLS" },
  { code: "travel-local", label: "Travel & Local", rawCode: "TRAVEL_AND_LOCAL" },
];

const COMMON_IOS_CATEGORIES: ChartCategoryOption[] = [
  { code: "all-apps", label: "All Apps", rawCode: null },
  { code: "books", label: "Books", rawCode: 6018 },
  { code: "business", label: "Business", rawCode: 6000 },
  { code: "education", label: "Education", rawCode: 6017 },
  { code: "entertainment", label: "Entertainment", rawCode: 6016 },
  { code: "finance", label: "Finance", rawCode: 6015 },
  { code: "food-drink", label: "Food & Drink", rawCode: 6023 },
  { code: "games", label: "Games", rawCode: 6014 },
  { code: "health-fitness", label: "Health & Fitness", rawCode: 6013 },
  { code: "lifestyle", label: "Lifestyle", rawCode: 6012 },
  { code: "medical", label: "Medical", rawCode: 6020 },
  { code: "music", label: "Music", rawCode: 6011 },
  { code: "navigation", label: "Navigation", rawCode: 6010 },
  { code: "news", label: "News", rawCode: 6009 },
  { code: "photo-video", label: "Photo & Video", rawCode: 6008 },
  { code: "productivity", label: "Productivity", rawCode: 6007 },
  { code: "shopping", label: "Shopping", rawCode: 6024 },
  { code: "social-networking", label: "Social Networking", rawCode: 6005 },
  { code: "sports", label: "Sports", rawCode: 6004 },
  { code: "travel", label: "Travel", rawCode: 6003 },
  { code: "utilities", label: "Utilities", rawCode: 6002 },
];

export const CHART_CATEGORY_OPTIONS: Record<
  ChartStoreType,
  ChartCategoryOption[]
> = {
  android: COMMON_ANDROID_CATEGORIES,
  ios: COMMON_IOS_CATEGORIES,
};

export function getChartCategoryOptions(
  store: ChartStoreType,
): ChartCategoryOption[] {
  return CHART_CATEGORY_OPTIONS[store];
}

export function findChartCategory(
  store: ChartStoreType,
  code: string,
): ChartCategoryOption | null {
  return (
    CHART_CATEGORY_OPTIONS[store].find((option) => option.code === code) ||
    null
  );
}

export function getChartTypeLabel(chartType: ChartType): string {
  return (
    CHART_TYPE_OPTIONS.find((option) => option.value === chartType)?.label ||
    chartType
  );
}
