import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";

export type WeeklyDeliveryClaimStatus =
  | "sending"
  | "accepted"
  | "failed"
  | "skipped";

export type WeeklyReportDeliveryRecord = {
  deliveryKey: string;
  status: WeeklyDeliveryClaimStatus;
  claimedAt?: string;
  claimOwner?: string;
  claimExpiresAt?: string;
  attemptCount?: number;
  lastAttemptAt?: string;
  acceptedAt?: string;
  providerMessageId?: string;
  lastError?: string;
};

export type WeeklyDeliveryClaimResult =
  | {
      acquired: true;
      ref: DocumentReference<DocumentData>;
      record: WeeklyReportDeliveryRecord;
    }
  | {
      acquired: false;
      reason: "already-accepted" | "already-skipped" | "lease-active" | "max-attempts";
      ref: DocumentReference<DocumentData>;
      record?: WeeklyReportDeliveryRecord;
    };

const WEEKLY_REPORT_DELIVERIES_COLLECTION = "weekly_report_deliveries";
const DEFAULT_WEEKLY_REPORT_CLAIM_TTL_MS = 15 * 60 * 1000;
const DEFAULT_WEEKLY_REPORT_MAX_ATTEMPTS = 3;

function hasActiveClaim(record: WeeklyReportDeliveryRecord | undefined, nowMs: number) {
  if (record?.status !== "sending") return false;
  const expiresAtMs =
    typeof record.claimExpiresAt === "string"
      ? Date.parse(record.claimExpiresAt)
      : Number.NaN;
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
}

export async function claimWeeklyReportDelivery(
  userDocRef: DocumentReference<DocumentData>,
  input: {
    deliveryKey: string;
    claimOwner: string;
    now?: Date;
    claimTtlMs?: number;
    maxAttempts?: number;
  },
): Promise<WeeklyDeliveryClaimResult> {
  const now = input.now || new Date();
  const claimTtlMs = input.claimTtlMs ?? DEFAULT_WEEKLY_REPORT_CLAIM_TTL_MS;
  const maxAttempts = input.maxAttempts ?? DEFAULT_WEEKLY_REPORT_MAX_ATTEMPTS;
  const ref = userDocRef
    .collection(WEEKLY_REPORT_DELIVERIES_COLLECTION)
    .doc(input.deliveryKey);

  return userDocRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const record = snapshot.data() as WeeklyReportDeliveryRecord | undefined;
    const nowMs = now.getTime();

    if (record?.status === "accepted") {
      return { acquired: false as const, reason: "already-accepted" as const, ref, record };
    }
    if (record?.status === "skipped") {
      return { acquired: false as const, reason: "already-skipped" as const, ref, record };
    }
    if (hasActiveClaim(record, nowMs)) {
      return { acquired: false as const, reason: "lease-active" as const, ref, record };
    }
    if (
      record?.status === "failed" &&
      (record.attemptCount || 0) >= maxAttempts
    ) {
      return { acquired: false as const, reason: "max-attempts" as const, ref, record };
    }

    const nextRecord: WeeklyReportDeliveryRecord = {
      deliveryKey: input.deliveryKey,
      status: "sending",
      claimedAt: now.toISOString(),
      claimOwner: input.claimOwner,
      claimExpiresAt: new Date(nowMs + claimTtlMs).toISOString(),
      attemptCount: (record?.attemptCount || 0) + 1,
      lastAttemptAt: now.toISOString(),
    };

    transaction.set(
      ref,
      {
        ...nextRecord,
        acceptedAt: FieldValue.delete(),
        providerMessageId: FieldValue.delete(),
        lastError: FieldValue.delete(),
      } satisfies DocumentData,
      { merge: true },
    );

    return { acquired: true as const, ref, record: nextRecord };
  });
}

export async function finalizeWeeklyReportDelivery(
  ref: DocumentReference<DocumentData>,
  input: {
    status: "accepted" | "failed" | "skipped";
    now?: Date;
    providerMessageId?: string | null;
    error?: string;
  },
) {
  const now = input.now || new Date();
  await ref.set(
    {
      status: input.status,
      claimExpiresAt: FieldValue.delete(),
      ...(input.status === "accepted"
        ? {
            acceptedAt: now.toISOString(),
            ...(input.providerMessageId
              ? { providerMessageId: input.providerMessageId }
              : {}),
            lastError: FieldValue.delete(),
          }
        : {}),
      ...(input.status !== "accepted"
        ? {
            lastError: input.error || input.status,
            providerMessageId: FieldValue.delete(),
          }
        : {}),
    } satisfies DocumentData,
    { merge: true },
  );
}
