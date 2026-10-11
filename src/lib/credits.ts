import type { Profile } from "@/types/database";

/** Base daily credit allowance granted to every account. */
export const BASE_DAILY_CREDITS = 100;
/** Extra daily credits granted to founding accounts (first 1,000 users). */
export const FOUNDING_CREDIT_BONUS = 500;
/** Extra daily credits granted for each successful referral. */
export const REFERRAL_CREDIT_BONUS = 10;
/** Maximum number of referrals that earn the daily credit bonus. */
export const MAX_REFERRALS = 12;
/** Highest reachable daily allowance for a standard account (100 + 12 × 10). */
export const MAX_DAILY_CREDITS =
  BASE_DAILY_CREDITS + REFERRAL_CREDIT_BONUS * MAX_REFERRALS;
/** Credits spent per 1080p video export. */
export const EXPORT_CREDIT_COST = 5;
/** Credits spent per AI auto-caption transcription. */
export const CAPTIONS_CREDIT_COST = 10;
/** Credits spent to create a new project. */
export const PROJECT_CREATE_CREDIT_COST = 5;

/** Referrals that count toward the bonus, clamped to the [0, MAX] range. */
export function bonusReferralCount(referralCount: number): number {
  if (!Number.isFinite(referralCount) || referralCount <= 0) return 0;
  return Math.min(Math.floor(referralCount), MAX_REFERRALS);
}

/**
 * Daily credit allowance for an account.
 *
 * Every account starts at {@link BASE_DAILY_CREDITS}; founding accounts add
 * {@link FOUNDING_CREDIT_BONUS}, and each successful referral permanently adds
 * {@link REFERRAL_CREDIT_BONUS} up to {@link MAX_REFERRALS}.
 */
export function dailyCreditLimit(
  referralCount = 0,
  isFounding = false
): number {
  return (
    BASE_DAILY_CREDITS +
    (isFounding ? FOUNDING_CREDIT_BONUS : 0) +
    REFERRAL_CREDIT_BONUS * bonusReferralCount(referralCount)
  );
}

/** Highest daily allowance reachable at the referral cap for an account type. */
export function maxDailyCredits(isFounding = false): number {
  return dailyCreditLimit(MAX_REFERRALS, isFounding);
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

/**
 * Applies the daily refill in memory; returns the fields to persist, if any.
 *
 * The allowance is reset to the account's current limit (base + referral
 * bonus) — it never carries unused credits over from a previous day.
 */
export function computeDailyReset(
  profile: Pick<Profile, "referral_count" | "is_founding_user" | "last_credit_reset">,
  now = new Date()
): { daily_credits: number; last_credit_reset: string } | null {
  if (!needsDailyReset(profile, now)) return null;
  return {
    daily_credits: dailyCreditLimit(
      profile.referral_count,
      profile.is_founding_user
    ),
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
