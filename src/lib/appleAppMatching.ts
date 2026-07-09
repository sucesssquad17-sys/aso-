type AppleSearchResultLike = {
  appId?: string | number;
  id?: string | number;
  trackId?: string | number;
  bundleId?: string;
  url?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function extractAppleNumericId(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const directDigits = normalized.match(/^\d+$/);
  if (directDigits) {
    return directDigits[0];
  }

  const idMatch = normalized.match(/(?:^|[/?#=&_-])id(\d+)(?:[/?#&._-]|$)/);
  if (idMatch) {
    return idMatch[1];
  }

  return null;
}

function extractBundleId(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized || !normalized.includes('.')) {
    return null;
  }

  if (/^[a-z0-9._-]+$/.test(normalized)) {
    return normalized;
  }

  return null;
}

export function getNormalizedAppleTargetIds(target: unknown) {
  const identifiers = new Set<string>();
  const normalized = normalizeText(target);

  if (normalized) {
    identifiers.add(normalized);
  }

  const numericId = extractAppleNumericId(target);
  if (numericId) {
    identifiers.add(numericId);
    identifiers.add(`id${numericId}`);
  }

  const bundleId = extractBundleId(target);
  if (bundleId) {
    identifiers.add(bundleId);
  }

  return {
    normalized,
    numericId,
    bundleId,
    identifiers,
  };
}

export function getNormalizedAppleResultIds(app: AppleSearchResultLike) {
  const identifiers = new Set<string>();
  const rawValues = [
    app.appId,
    app.id,
    app.trackId,
    app.bundleId,
    app.url,
  ];

  rawValues.forEach((value) => {
    const normalized = normalizeText(value);
    if (normalized) {
      identifiers.add(normalized);
    }

    const numericId = extractAppleNumericId(value);
    if (numericId) {
      identifiers.add(numericId);
      identifiers.add(`id${numericId}`);
    }

    const bundleId = extractBundleId(value);
    if (bundleId) {
      identifiers.add(bundleId);
    }
  });

  return identifiers;
}

export function findAppleSearchResultIndex(
  results: AppleSearchResultLike[],
  target: unknown,
) {
  const targetIds = getNormalizedAppleTargetIds(target).identifiers;
  if (targetIds.size === 0) {
    return -1;
  }

  return results.findIndex((app) => {
    const resultIds = getNormalizedAppleResultIds(app);
    for (const candidateId of resultIds) {
      if (targetIds.has(candidateId)) {
        return true;
      }
    }
    return false;
  });
}
