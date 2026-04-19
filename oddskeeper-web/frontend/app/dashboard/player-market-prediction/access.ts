// ─── Player Market Prediction — Email Whitelist ───────────────────────────────
// Add/remove email addresses here to control access.

export const PLAYER_MARKET_ALLOWED_EMAILS: string[] = [
  "admin@pixellious.com",
  "test@test.com",
  "pokego5895@gmail.com",
  "seyitozdol@yahoo.com",
  // Add more emails here
];

export function hasPlayerMarketAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  return PLAYER_MARKET_ALLOWED_EMAILS
    .map((e) => e.toLowerCase().trim())
    .includes(email.toLowerCase().trim());
}
