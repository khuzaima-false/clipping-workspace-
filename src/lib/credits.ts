import type { Profile } from "@/types/database";

/**
 * True while the account should see no ads. (Ads are separate from rendering —
 * the editor itself is fully free with unlimited client-side exports.)
 */
export function isAdFree(
  profile: Pick<Profile, "is_ad_free" | "ad_free_until"> | null,
  now = new Date()
): boolean {
  if (!profile || !profile.is_ad_free) return false;
  if (!profile.ad_free_until) return true;
  const expiry = new Date(profile.ad_free_until).getTime();
  return Number.isFinite(expiry) ? expiry > now.getTime() : true;
}
