const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.join(process.cwd(), ".env"),
  quiet: true,
});

const admin = require("firebase-admin");
const googlePlay = require("google-play-scraper").default;

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawServiceAccount) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
}

const serviceAccount = JSON.parse(
  rawServiceAccount.replace(/^'/, "").replace(/'$/, ""),
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  const appIds = new Set();
  let uid = null;
  let apply = false;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg.startsWith("--uid=")) {
      uid = arg.slice("--uid=".length).trim() || null;
      continue;
    }
    if (arg.startsWith("--app-id=")) {
      const value = arg.slice("--app-id=".length).trim();
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => appIds.add(entry));
    }
  }

  return {
    uid,
    apply,
    appIds,
  };
}

function normalizeCountryCode(country, fallback = "us") {
  if (typeof country !== "string") return fallback;
  const normalized = country.trim().toLowerCase();
  return normalized || fallback;
}

function getLegacyTrackingGroupId({ appId, keyword, store }) {
  return `legacy:${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

function buildAppTitleLookup(data) {
  const titles = new Map();

  const trackedApps = Array.isArray(data.trackedApps) ? data.trackedApps : [];
  trackedApps.forEach((app) => {
    if (!app || typeof app !== "object") return;
    const key = `${app.store === "ios" ? "ios" : "android"}:${String(app.appId || "").trim()}`;
    if (!key.endsWith(":")) {
      const title =
        typeof app.title === "string" && app.title.trim() ? app.title.trim() : null;
      if (title) titles.set(key, title);
    }
  });

  const snapshots = Array.isArray(data.appAnalysisSnapshots)
    ? data.appAnalysisSnapshots
    : [];
  snapshots.forEach((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const key = `${snapshot.store === "ios" ? "ios" : "android"}:${String(
      snapshot.appId || "",
    ).trim()}`;
    if (!key.endsWith(":")) {
      const title =
        typeof snapshot.appTitle === "string" && snapshot.appTitle.trim()
          ? snapshot.appTitle.trim()
          : null;
      if (title) titles.set(key, title);
    }
  });

  return titles;
}

function buildAppRecordLookup(data) {
  const records = new Map();
  const trackedApps = Array.isArray(data.trackedApps) ? data.trackedApps : [];
  trackedApps.forEach((app) => {
    if (!app || typeof app !== "object") return;
    const store = app.store === "ios" ? "ios" : "android";
    const appId = typeof app.appId === "string" ? app.appId.trim() : "";
    if (!appId) return;
    records.set(`${store}:${appId}`, { ...app, store, appId });
  });

  const competitorGroups = Array.isArray(data.competitorGroups)
    ? data.competitorGroups
    : [];
  competitorGroups.forEach((group) => {
    if (!group || typeof group !== "object") return;
    const apps = []
      .concat(group.ownApp ? [group.ownApp] : [])
      .concat(Array.isArray(group.competitors) ? group.competitors : []);
    apps.forEach((app) => {
      if (!app || typeof app !== "object") return;
      const store = app.store === "ios" ? "ios" : "android";
      const appId = typeof app.appId === "string" ? app.appId.trim() : "";
      if (!appId) return;
      const key = `${store}:${appId}`;
      if (!records.has(key)) {
        records.set(key, { ...app, store, appId });
      }
    });
  });

  const competitorTrackedKeywords = Array.isArray(data.competitorTrackedKeywords)
    ? data.competitorTrackedKeywords
    : [];
  competitorTrackedKeywords.forEach((record) => {
    if (!record || typeof record !== "object" || !Array.isArray(record.apps)) return;
    record.apps.forEach((app) => {
      if (!app || typeof app !== "object") return;
      const store = app.store === "ios" ? "ios" : "android";
      const appId = typeof app.appId === "string" ? app.appId.trim() : "";
      if (!appId) return;
      const key = `${store}:${appId}`;
      if (!records.has(key)) {
        records.set(key, { ...app, store, appId });
      }
    });
  });

  return records;
}

function createCompetitorTrackedKeywordId(groupId, keyword, country) {
  const slug =
    keyword
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "keyword";
  const normalizedCountry = normalizeCountryCode(country, "us");
  return `comp-track:${groupId}:${slug}:${normalizedCountry}`;
}

async function fetchAppMetadata(store, appId, country) {
  if (store !== "android") {
    return null;
  }
  try {
    const app = await googlePlay.app({
      appId,
      lang: "en",
      country: normalizeCountryCode(country, "us"),
    });
    return {
      title: typeof app.title === "string" && app.title.trim() ? app.title.trim() : appId,
      developer:
        typeof app.developer === "string" && app.developer.trim()
          ? app.developer.trim()
          : "",
      icon: typeof app.icon === "string" ? app.icon : "",
      url: typeof app.url === "string" ? app.url : undefined,
      category: typeof app.genre === "string" ? app.genre : undefined,
      description: typeof app.summary === "string" ? app.summary : "",
    };
  } catch (_error) {
    return null;
  }
}

function appNeedsMetadataRefresh(existing, appId) {
  if (!existing || typeof existing !== "object") return true;
  const title =
    typeof existing.title === "string" && existing.title.trim()
      ? existing.title.trim()
      : "";
  const developer =
    typeof existing.developer === "string" && existing.developer.trim()
      ? existing.developer.trim()
      : "";
  const icon =
    typeof existing.icon === "string" && existing.icon.trim()
      ? existing.icon.trim()
      : "";
  return !title || title === appId || (!developer && !icon);
}

function buildRecoveredTrackedKeywords(data, appIds) {
  const rankHistory = Array.isArray(data.rankHistory) ? data.rankHistory : [];
  const titleLookup = buildAppTitleLookup(data);
  const canonicalGroupIds = new Map();
  const recovered = new Map();

  rankHistory.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (entry.isSimulated) return;
    if (typeof entry.appId !== "string" || typeof entry.keyword !== "string") return;
    const appId = entry.appId.trim();
    if (!appId) return;
    if (appIds.size > 0 && !appIds.has(appId)) return;
    const keyword = entry.keyword.trim();
    if (!keyword) return;
    const store = entry.store === "ios" ? "ios" : "android";
    const country = normalizeCountryCode(entry.country, "us");
    const timestamp =
      typeof entry.timestamp === "string" && entry.timestamp
        ? entry.timestamp
        : new Date(0).toISOString();
    const baseKey = `${store}:${appId}:${keyword.toLowerCase()}`;
    const existingGroupId = canonicalGroupIds.get(baseKey);
    const groupId =
      existingGroupId ||
      (typeof entry.groupId === "string" && entry.groupId.trim()
        ? entry.groupId.trim()
        : getLegacyTrackingGroupId({ appId, keyword, store }));
    canonicalGroupIds.set(baseKey, groupId);

    const trackedKey = `${baseKey}:${country}`;
    const title = titleLookup.get(`${store}:${appId}`) || appId;
    const existing = recovered.get(trackedKey);
    const candidate = {
      groupId,
      keyword,
      appId,
      appTitle: title,
      store,
      country,
      createdAt: timestamp,
      lastRank: Number.isFinite(entry.rank) ? Number(entry.rank) : -1,
      lastChecked: timestamp,
      lastCheckStatus:
        Number.isFinite(entry.rank) && Number(entry.rank) === -1 ? "not_ranked" : "ok",
    };

    if (!existing) {
      recovered.set(trackedKey, candidate);
      return;
    }

    if (new Date(timestamp).getTime() >= new Date(existing.lastChecked).getTime()) {
      existing.lastRank = candidate.lastRank;
      existing.lastChecked = candidate.lastChecked;
      existing.lastCheckStatus = candidate.lastCheckStatus;
      existing.appTitle = candidate.appTitle;
    }

    if (new Date(timestamp).getTime() < new Date(existing.createdAt).getTime()) {
      existing.createdAt = timestamp;
    }
  });

  return Array.from(recovered.values()).sort((a, b) => {
    if (a.appTitle !== b.appTitle) return a.appTitle.localeCompare(b.appTitle);
    if (a.keyword !== b.keyword) return a.keyword.localeCompare(b.keyword);
    return a.country.localeCompare(b.country);
  });
}

function buildRecoveredTrackedApps(existingTrackedApps, trackedKeywords) {
  const byKey = new Map();

  (Array.isArray(existingTrackedApps) ? existingTrackedApps : []).forEach((app) => {
    if (!app || typeof app !== "object") return;
    const appId = typeof app.appId === "string" ? app.appId.trim() : "";
    if (!appId) return;
    const store = app.store === "ios" ? "ios" : "android";
    byKey.set(`${store}:${appId}`, { ...app });
  });

  trackedKeywords.forEach((trackedKeyword) => {
    const appKey = `${trackedKeyword.store}:${trackedKeyword.appId}`;
    const existing = byKey.get(appKey);
    if (!existing) {
      byKey.set(appKey, {
        appKey,
        appId: trackedKeyword.appId,
        store: trackedKeyword.store,
        title: trackedKeyword.appTitle,
        developer: "",
        icon: "",
        kind: "own",
        source: "manual",
        countries: [trackedKeyword.country],
        createdAt: trackedKeyword.createdAt,
        updatedAt: trackedKeyword.lastChecked,
        lastAnalyzedAt: trackedKeyword.lastChecked,
      });
      return;
    }

    const countries = new Set(
      Array.isArray(existing.countries) ? existing.countries.map((entry) => normalizeCountryCode(entry, "us")) : [],
    );
    countries.add(trackedKeyword.country);
    existing.countries = Array.from(countries).sort();
    existing.title =
      typeof existing.title === "string" && existing.title.trim()
        ? existing.title
        : trackedKeyword.appTitle;
    existing.updatedAt =
      new Date(trackedKeyword.lastChecked).getTime() >
      new Date(existing.updatedAt || 0).getTime()
        ? trackedKeyword.lastChecked
        : existing.updatedAt;
    existing.lastAnalyzedAt =
      !existing.lastAnalyzedAt ||
      new Date(trackedKeyword.lastChecked).getTime() >
        new Date(existing.lastAnalyzedAt).getTime()
        ? trackedKeyword.lastChecked
        : existing.lastAnalyzedAt;
    existing.kind = existing.kind === "competitor" ? "competitor" : "own";
  });

  return Array.from(byKey.values()).sort((a, b) => {
    const titleA =
      typeof a.title === "string" && a.title.trim() ? a.title.trim() : a.appId;
    const titleB =
      typeof b.title === "string" && b.title.trim() ? b.title.trim() : b.appId;
    return titleA.localeCompare(titleB);
  });
}

async function buildRecoveredCompetitorState(
  data,
  appIds,
  recoveredTrackedApps,
  recoveredTrackedKeywords,
) {
  const competitorRankHistory = Array.isArray(data.competitorRankHistory)
    ? data.competitorRankHistory
    : [];
  const existingGroups = Array.isArray(data.competitorGroups) ? data.competitorGroups : [];
  const existingTrackedKeywords = Array.isArray(data.competitorTrackedKeywords)
    ? data.competitorTrackedKeywords
    : [];
  const appRecordLookup = buildAppRecordLookup(data);
  recoveredTrackedApps.forEach((app) => {
    appRecordLookup.set(`${app.store}:${app.appId}`, app);
  });

  const ownAppKeys = new Set(
    recoveredTrackedApps
      .filter((app) => app && app.kind === "own")
      .map((app) => `${app.store}:${app.appId}`),
  );
  recoveredTrackedKeywords.forEach((entry) => {
    ownAppKeys.add(`${entry.store}:${entry.appId}`);
  });

  const groupsById = new Map();
  competitorRankHistory.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (typeof entry.groupId !== "string" || !entry.groupId.trim()) return;
    if (typeof entry.appId !== "string" || !entry.appId.trim()) return;
    if (typeof entry.keyword !== "string" || !entry.keyword.trim()) return;
    const appId = entry.appId.trim();
    const store = entry.store === "ios" ? "ios" : "android";
    const appKey =
      typeof entry.appKey === "string" && entry.appKey.trim()
        ? entry.appKey.trim()
        : `${store}:${appId}`;
    const groupId = entry.groupId.trim();
    const current = groupsById.get(groupId) || [];
    current.push({
      ...entry,
      appId,
      appKey,
      groupId,
      store,
      keyword: entry.keyword.trim(),
      country: normalizeCountryCode(entry.country, "us"),
      timestamp:
        typeof entry.timestamp === "string" && entry.timestamp
          ? entry.timestamp
          : new Date(0).toISOString(),
      rank: Number.isFinite(entry.rank) ? Number(entry.rank) : -1,
      rankDepth: Number.isFinite(entry.rankDepth) ? Number(entry.rankDepth) : 100,
    });
    groupsById.set(groupId, current);
  });

  const recoveredGroups = [];
  const recoveredCompetitorTrackedKeywords = [];

  for (const [groupId, entries] of groupsById.entries()) {
    const appKeysInGroup = new Set(entries.map((entry) => entry.appId));
    if (appIds.size > 0 && !Array.from(appKeysInGroup).some((appId) => appIds.has(appId))) {
      continue;
    }

    const appStats = new Map();
    entries.forEach((entry) => {
      const current = appStats.get(entry.appKey) || {
        appKey: entry.appKey,
        appId: entry.appId,
        store: entry.store,
        count: 0,
        earliestAt: entry.timestamp,
        latestAt: entry.timestamp,
        countries: new Set(),
      };
      current.count += 1;
      current.countries.add(entry.country);
      if (new Date(entry.timestamp).getTime() < new Date(current.earliestAt).getTime()) {
        current.earliestAt = entry.timestamp;
      }
      if (new Date(entry.timestamp).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = entry.timestamp;
      }
      appStats.set(entry.appKey, current);
    });

    const groupApps = [];
    for (const appStat of appStats.values()) {
      const existing = appRecordLookup.get(appStat.appKey);
      const fetchedMetadata = appNeedsMetadataRefresh(existing, appStat.appId)
        ? await fetchAppMetadata(
            appStat.store,
            appStat.appId,
            Array.from(appStat.countries)[0] || "us",
          )
        : null;
      const metadata = {
        ...(existing && typeof existing === "object" ? existing : {}),
        ...(fetchedMetadata && typeof fetchedMetadata === "object"
          ? fetchedMetadata
          : {}),
      };
      groupApps.push({
        appKey: appStat.appKey,
        appId: appStat.appId,
        store: appStat.store,
        title:
          typeof metadata.title === "string" && metadata.title.trim()
            ? metadata.title.trim()
            : appStat.appId,
        description:
          typeof metadata.description === "string" ? metadata.description : "",
        developer: typeof metadata.developer === "string" ? metadata.developer : "",
        icon: typeof metadata.icon === "string" ? metadata.icon : "",
        url: typeof metadata.url === "string" ? metadata.url : undefined,
        category:
          typeof metadata.category === "string" ? metadata.category : undefined,
        earliestAt: appStat.earliestAt,
        latestAt: appStat.latestAt,
        count: appStat.count,
      });
    }

    groupApps.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    const inferredOwnApp =
      groupApps.find((app) => ownAppKeys.has(app.appKey)) || groupApps[0] || null;
    if (!inferredOwnApp) {
      continue;
    }

    const ownApp = {
      appKey: inferredOwnApp.appKey,
      appId: inferredOwnApp.appId,
      store: inferredOwnApp.store,
      role: "own",
      title: inferredOwnApp.title,
      description: inferredOwnApp.description,
      developer: inferredOwnApp.developer,
      icon: inferredOwnApp.icon,
      ...(inferredOwnApp.url ? { url: inferredOwnApp.url } : {}),
      ...(inferredOwnApp.category ? { category: inferredOwnApp.category } : {}),
    };

    const competitorApps = groupApps
      .filter((app) => app.appKey !== inferredOwnApp.appKey)
      .map((app) => ({
        appKey: app.appKey,
        appId: app.appId,
        store: app.store,
        role: "competitor",
        title: app.title,
        description: app.description,
        developer: app.developer,
        icon: app.icon,
        ...(app.url ? { url: app.url } : {}),
        ...(app.category ? { category: app.category } : {}),
      }));

    if (competitorApps.length === 0) {
      continue;
    }

    const keywordBuckets = new Map();
    entries.forEach((entry) => {
      const bucketKey = `${entry.keyword.toLowerCase()}:${entry.country}`;
      const current = keywordBuckets.get(bucketKey) || [];
      current.push(entry);
      keywordBuckets.set(bucketKey, current);
    });

    const trackedKeywordIds = [];
    for (const [bucketKey, bucketEntries] of keywordBuckets.entries()) {
      const [keywordPart, country] = bucketKey.split(":");
      const keyword = bucketEntries[0]?.keyword || keywordPart;
      const trackedKeywordId = createCompetitorTrackedKeywordId(groupId, keyword, country);
      trackedKeywordIds.push(trackedKeywordId);

      const latestByApp = new Map();
      let createdAt = bucketEntries[0].timestamp;
      let updatedAt = bucketEntries[0].timestamp;
      bucketEntries.forEach((entry) => {
        if (new Date(entry.timestamp).getTime() < new Date(createdAt).getTime()) {
          createdAt = entry.timestamp;
        }
        if (new Date(entry.timestamp).getTime() > new Date(updatedAt).getTime()) {
          updatedAt = entry.timestamp;
        }
        const current = latestByApp.get(entry.appKey);
        if (!current || new Date(entry.timestamp).getTime() >= new Date(current.timestamp).getTime()) {
          latestByApp.set(entry.appKey, entry);
        }
      });

      const apps = [ownApp].concat(competitorApps).map((app) => {
        const latest = latestByApp.get(app.appKey);
        const lastRank = latest ? latest.rank : -1;
        return {
          ...app,
          lastRank,
          lastChecked: latest ? latest.timestamp : updatedAt,
          lastCheckStatus: lastRank === -1 ? "not_ranked" : "ok",
        };
      });

      recoveredCompetitorTrackedKeywords.push({
        trackedKeywordId,
        groupId,
        keyword,
        store: bucketEntries[0].store,
        country,
        apps,
        createdAt,
        updatedAt,
        lastCheckedAt: updatedAt,
      });
    }

    const timestamps = entries.map((entry) => entry.timestamp).sort();
    recoveredGroups.push({
      groupId,
      store: entries[0].store,
      country: entries[0].country,
      mode: "fast",
      ownApp,
      competitors: competitorApps,
      trackedKeywordIds: trackedKeywordIds.sort(),
      createdAt: timestamps[0] || new Date(0).toISOString(),
      updatedAt: timestamps[timestamps.length - 1] || new Date(0).toISOString(),
      lastAnalyzedAt: timestamps[timestamps.length - 1] || new Date(0).toISOString(),
    });
  }

  const recoveredGroupIds = new Set(recoveredGroups.map((group) => group.groupId));

  return {
    competitorGroups:
      recoveredGroups.length > 0 ? recoveredGroups : existingGroups,
    competitorTrackedKeywords:
      recoveredCompetitorTrackedKeywords.length > 0
        ? recoveredCompetitorTrackedKeywords
        : existingTrackedKeywords,
    competitorGroupSnapshots: Array.isArray(data.competitorGroupSnapshots)
      ? data.competitorGroupSnapshots.filter((snapshot) =>
          recoveredGroupIds.has(snapshot.groupId),
        )
      : [],
  };
}

function summarizeDoc(
  uid,
  before,
  recoveredTrackedKeywords,
  recoveredTrackedApps,
  competitorState,
) {
  return {
    uid,
    before: {
      trackedKeywords: Array.isArray(before.trackedKeywords) ? before.trackedKeywords.length : 0,
      rankHistory: Array.isArray(before.rankHistory) ? before.rankHistory.length : 0,
      trackedApps: Array.isArray(before.trackedApps) ? before.trackedApps.length : 0,
      competitorGroups: Array.isArray(before.competitorGroups) ? before.competitorGroups.length : 0,
      competitorTrackedKeywords: Array.isArray(before.competitorTrackedKeywords)
        ? before.competitorTrackedKeywords.length
        : 0,
      competitorRankHistory: Array.isArray(before.competitorRankHistory)
        ? before.competitorRankHistory.length
        : 0,
    },
    after: {
      trackedKeywords: recoveredTrackedKeywords.length,
      trackedApps: recoveredTrackedApps.length,
      competitorGroups: competitorState.competitorGroups.length,
      competitorTrackedKeywords: competitorState.competitorTrackedKeywords.length,
    },
    sampleTrackedKeywords: recoveredTrackedKeywords.slice(0, 10).map((entry) => ({
      appId: entry.appId,
      appTitle: entry.appTitle,
      keyword: entry.keyword,
      country: entry.country,
      lastRank: entry.lastRank,
      lastChecked: entry.lastChecked,
    })),
    sampleCompetitorGroups: competitorState.competitorGroups.slice(0, 10).map((group) => ({
      groupId: group.groupId,
      ownApp: group.ownApp.title,
      competitors: group.competitors.map((app) => app.title),
      trackedKeywordCount: group.trackedKeywordIds.length,
      updatedAt: group.updatedAt,
    })),
  };
}

async function run() {
  const { uid, apply, appIds } = parseArgs(process.argv.slice(2));

  if (apply && !uid) {
    throw new Error("--apply requires --uid=<firebase uid>.");
  }

  if (!uid) {
    const snap = await db.collection("users").get();
    const suspicious = snap.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          uid: doc.id,
          trackedKeywords: Array.isArray(data.trackedKeywords)
            ? data.trackedKeywords.length
            : 0,
          rankHistory: Array.isArray(data.rankHistory) ? data.rankHistory.length : 0,
          trackedApps: Array.isArray(data.trackedApps) ? data.trackedApps.length : 0,
        };
      })
      .filter((entry) => entry.rankHistory > 0 && entry.trackedKeywords === 0);
    console.log(JSON.stringify({ suspicious }, null, 2));
    return;
  }

  const docRef = db.collection("users").doc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error(`User document not found for uid ${uid}.`);
  }

  const before = snap.data() || {};
  const recoveredTrackedKeywords = buildRecoveredTrackedKeywords(before, appIds);
  const recoveredTrackedApps = buildRecoveredTrackedApps(
    before.trackedApps,
    recoveredTrackedKeywords,
  );
  const competitorState = await buildRecoveredCompetitorState(
    before,
    appIds,
    recoveredTrackedApps,
    recoveredTrackedKeywords,
  );
  const summary = summarizeDoc(
    uid,
    before,
    recoveredTrackedKeywords,
    recoveredTrackedApps,
    competitorState,
  );

  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
    return;
  }

  const backupDir = path.join(process.cwd(), "scratch");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `tracking-recovery-backup-${uid}-${stamp}.json`,
  );
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        uid,
        savedAt: new Date().toISOString(),
        before,
        summary,
      },
      null,
      2,
    ),
  );

  await docRef.set(
    {
      trackedKeywords: recoveredTrackedKeywords,
      trackedApps: recoveredTrackedApps,
      competitorGroups: competitorState.competitorGroups,
      competitorTrackedKeywords: competitorState.competitorTrackedKeywords,
      competitorGroupSnapshots: competitorState.competitorGroupSnapshots,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  console.log(
    JSON.stringify(
      {
        applied: true,
        backupPath,
        ...summary,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
