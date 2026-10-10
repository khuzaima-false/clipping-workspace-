import type { Profile } from "@/types/database";

/** Daily credit allowance for a standard account. */
export const STANDARD_DAILY_CREDITS = 20;
/** Daily credit allowance for a founding account (first 1,000 users). */
export const FOUNDING_DAILY_CREDITS = 25;
/** Credits spent per 1080p video export. */
export const EXPORT_CREDIT_COST = 2;
/** Credits spent per AI auto-caption transcription. */
export const CAPTIONS_CREDIT_COST = 3;
/** Successful referrals needed to unlock ad-free exporting. */
export const REFERRALS_FOR_AD_FREE = 10;
/** Length of the ad-free reward in days. */
export const AD_FREE_DAYS = 90;

/** Daily credit allowance for an account. */
export function dailyCreditLimit(isFounding: boolean): number {
  return isFounding ? FOUNDING_DAILY_CREDITS : STANDARD_DAILY_CREDITS;
}

/** UTC calendar day key (`YYYY-MM-DD`) for a timestamp. */
export function utcDayKey(value: string | Date, now = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return utcDayKey(now);
  return date.toISOString().slice(0, 10);
}

/** True when the stored reset timestamp falls before today (UTC). */
export function needsDailyReset(
  profile: Pick<Profile, "last_credit_reset">,
  now = new Date()
): boolean {
  if (!profile.last_credit_reset) return true;
  return utcDayKey(profile.last_credit_reset, now) < utcDayKey(now, now);
}

/** Applies the daily refill in memory; returns the fields to persist, if any. */
export function computeDailyReset(
  profile: Pick<Profile, "is_founding_user" | "last_credit_reset">,
  now = new Date()
): { daily_credits: number; last_credit_reset: string } | null {
  if (!needsDailyReset(profile, now)) return null;
  return {
    daily_credits: dailyCreditLimit(profile.is_founding_user),
    last_credit_reset: now.toISOString(),
  };
}

/** True while the account should see no ads. */
export function isAdFree(
  profile: Pick<Profile, "is_ad_free" | "ad_free_until"> | null,
  now = new Date()
): boolean {
  if (!profile || !profile.is_ad_free) return false;
  if (!profile.ad_free_until) return true;
  const expiry = new Date(profile.ad_free_until).getTime();
  return Number.isFinite(expiry) ? expiry > now.getTime() : true;
}

/** Days remaining on the ad-free reward (0 when not ad-free). */
export function adFreeDaysRemaining(
  profile: Pick<Profile, "is_ad_free" | "ad_free_until"> | null
): number {
  if (!isAdFree(profile)) return 0;
  if (!profile?.ad_free_until) return AD_FREE_DAYS;
  const ms = new Date(profile.ad_free_until).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Builds the public shareable referral URL for a user id. */
export function referralUrl(userId: string, origin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base =
    configured && configured.length > 0
      ? configured
      : origin && origin.length > 0
        ? origin
        : "https://forgevyn.com";
  return `${base.replace(/\/+$/, "")}/ref/${userId}`;
}
