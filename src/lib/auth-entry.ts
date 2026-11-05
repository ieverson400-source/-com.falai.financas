export const ACCOUNT_SEEN_KEY = "falai-account-seen";

export function authEntryMode(accountSeen: string | null): "signin" | "signup" {
  return accountSeen === "true" ? "signin" : "signup";
}