export type CountryOption = {
  code: string;
  name: string;
};

export const PRIORITY_TRACKING_COUNTRY_CODES = [
  'us',
  'gb',
  'ca',
  'au',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'se',
  'jp',
  'kr',
  'in',
  'sg',
  'hk',
  'tw',
  'br',
  'mx',
  'ae',
  'sa',
] as const;

const RAW_COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'ar', name: 'Argentina' },
  { code: 'at', name: 'Austria' },
  { code: 'au', name: 'Australia' },
  { code: 'be', name: 'Belgium' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'bh', name: 'Bahrain' },
  { code: 'br', name: 'Brazil' },
  { code: 'bw', name: 'Botswana' },
  { code: 'by', name: 'Belarus' },
  { code: 'ca', name: 'Canada' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'cl', name: 'Chile' },
  { code: 'co', name: 'Colombia' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'cy', name: 'Cyprus' },
  { code: 'cz', name: 'Czech Republic' },
  { code: 'de', name: 'Germany' },
  { code: 'dk', name: 'Denmark' },
  { code: 'do', name: 'Dominican Republic' },
  { code: 'dz', name: 'Algeria' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'ee', name: 'Estonia' },
  { code: 'eg', name: 'Egypt' },
  { code: 'es', name: 'Spain' },
  { code: 'fi', name: 'Finland' },
  { code: 'fr', name: 'France' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'gh', name: 'Ghana' },
  { code: 'gr', name: 'Greece' },
  { code: 'gt', name: 'Guatemala' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'hn', name: 'Honduras' },
  { code: 'hr', name: 'Croatia' },
  { code: 'hu', name: 'Hungary' },
  { code: 'id', name: 'Indonesia' },
  { code: 'ie', name: 'Ireland' },
  { code: 'il', name: 'Israel' },
  { code: 'in', name: 'India' },
  { code: 'is', name: 'Iceland' },
  { code: 'it', name: 'Italy' },
  { code: 'jm', name: 'Jamaica' },
  { code: 'jo', name: 'Jordan' },
  { code: 'jp', name: 'Japan' },
  { code: 'ke', name: 'Kenya' },
  { code: 'kr', name: 'South Korea' },
  { code: 'kw', name: 'Kuwait' },
  { code: 'kz', name: 'Kazakhstan' },
  { code: 'lb', name: 'Lebanon' },
  { code: 'lk', name: 'Sri Lanka' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'lv', name: 'Latvia' },
  { code: 'ma', name: 'Morocco' },
  { code: 'mt', name: 'Malta' },
  { code: 'mx', name: 'Mexico' },
  { code: 'my', name: 'Malaysia' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'no', name: 'Norway' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'om', name: 'Oman' },
  { code: 'pa', name: 'Panama' },
  { code: 'pe', name: 'Peru' },
  { code: 'ph', name: 'Philippines' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'pl', name: 'Poland' },
  { code: 'pt', name: 'Portugal' },
  { code: 'qa', name: 'Qatar' },
  { code: 'ro', name: 'Romania' },
  { code: 'rs', name: 'Serbia' },
  { code: 'ru', name: 'Russia' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'se', name: 'Sweden' },
  { code: 'sg', name: 'Singapore' },
  { code: 'si', name: 'Slovenia' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'sv', name: 'El Salvador' },
  { code: 'th', name: 'Thailand' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'tr', name: 'Turkey' },
  { code: 'tw', name: 'Taiwan' },
  { code: 'tz', name: 'Tanzania' },
  { code: 'ua', name: 'Ukraine' },
  { code: 'ug', name: 'Uganda' },
  { code: 'us', name: 'United States' },
  { code: 'uy', name: 'Uruguay' },
  { code: 've', name: 'Venezuela' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'za', name: 'South Africa' },
  { code: 'zw', name: 'Zimbabwe' },
];

export const COUNTRY_OPTIONS: CountryOption[] = [...RAW_COUNTRY_OPTIONS].sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_CODE_SET = new Set(COUNTRY_OPTIONS.map((country) => country.code));

const COUNTRY_NAME_MAP = new Map(COUNTRY_OPTIONS.map((country) => [country.code, country.name]));

export function normalizeCountryCode(country: string | null | undefined, fallback = 'us') {
  const normalized = typeof country === 'string' ? country.trim().toLowerCase() : '';
  if (COUNTRY_CODE_SET.has(normalized)) {
    return normalized;
  }
  return fallback;
}

export function findCountryName(country: string | null | undefined) {
  const normalized = normalizeCountryCode(country, '');
  return normalized ? COUNTRY_NAME_MAP.get(normalized) || normalized.toUpperCase() : '';
}
