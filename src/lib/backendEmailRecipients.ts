import type {
  DocumentData,
  DocumentReference,
} from "firebase-admin/firestore";

import { isValidEmailAddress, normalizeEmailAddress } from "./backendEmail";

export type EmailPreferenceCategory = "alert" | "weekly" | "announcement";

export type EmailRecipientResolutionStatus =
  | "ready"
  | "opted_out"
  | "account_deleted"
  | "no_email"
  | "invalid_email"
  | "configuration_error";

export type EmailRecipientResolution = {
  status: EmailRecipientResolutionStatus;
  email?: string;
  source?: "billing" | "auth";
  reason: string;
};

type UserEmailPreferenceShape = {
  accountStatus?: string;
  billingEmail?: string;
  alertEmailsEnabled?: boolean;
  announcementEmailsEnabled?: boolean;
  weeklyReportSettings?: {
    enabled?: boolean;
  };
};

function isDeletedAccount(userData: UserEmailPreferenceShape | undefined) {
  return (
    userData?.accountStatus === "deleted" ||
    userData?.accountStatus === "deleting"
  );
}

function isCategoryEnabled(
  userData: UserEmailPreferenceShape | undefined,
  category: EmailPreferenceCategory,
) {
  if (category === "alert") {
    return userData?.alertEmailsEnabled !== false;
  }
  if (category === "announcement") {
    return userData?.announcementEmailsEnabled !== false;
  }
  return userData?.weeklyReportSettings?.enabled === true;
}

export async function resolveCategoryEmailRecipient(
  userDocRef: DocumentReference<DocumentData>,
  input: {
    category: EmailPreferenceCategory;
    resolveAuthEmail: (uid: string) => Promise<string | null>;
  },
): Promise<EmailRecipientResolution> {
  let userData: UserEmailPreferenceShape | undefined;
  try {
    const userSnapshot = await userDocRef.get();
    userData = userSnapshot.data() as UserEmailPreferenceShape | undefined;
  } catch (error) {
    return {
      status: "configuration_error",
      reason:
        error instanceof Error && error.message
          ? error.message
          : "failed-to-read-user-document",
    };
  }

  if (isDeletedAccount(userData)) {
    return {
      status: "account_deleted",
      reason: "account-deleted",
    };
  }

  if (!isCategoryEnabled(userData, input.category)) {
    return {
      status: "opted_out",
      reason: `${input.category}-emails-disabled`,
    };
  }

  const billingEmail = normalizeEmailAddress(userData?.billingEmail);
  if (billingEmail) {
    if (isValidEmailAddress(billingEmail)) {
      return {
        status: "ready",
        email: billingEmail,
        source: "billing",
        reason: "billing-email",
      };
    }
  }

  let authEmail: string | null = null;
  try {
    authEmail = normalizeEmailAddress(await input.resolveAuthEmail(userDocRef.id));
  } catch (error) {
    return {
      status: "configuration_error",
      reason:
        error instanceof Error && error.message
          ? error.message
          : "failed-to-resolve-auth-email",
    };
  }

  if (!authEmail) {
    return {
      status: billingEmail ? "invalid_email" : "no_email",
      reason: billingEmail ? "invalid-billing-email" : "missing-account-email",
    };
  }

  if (!isValidEmailAddress(authEmail)) {
    return {
      status: "invalid_email",
      reason: "invalid-auth-email",
    };
  }

  return {
    status: "ready",
    email: authEmail,
    source: "auth",
    reason: "auth-email",
  };
}
