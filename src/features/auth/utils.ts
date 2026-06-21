export function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup.";
    case "auth/cancelled-popup-request":
      return "Another Google sign-in attempt is already in progress.";
    case "auth/unauthorized-domain":
      return "This local URL is not authorized in Firebase Auth. Use localhost or add this domain in Firebase Authorized Domains.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase Auth yet.";
    case "auth/admin-restricted-operation":
      return "This sign-in method is restricted by your Firebase project settings.";
    case "auth/web-storage-unsupported":
      return "This browser blocked the storage required for sign-in. Try a standard browser window.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    default:
      return "Authentication failed. Check your Firebase auth providers and try again.";
  }
}
