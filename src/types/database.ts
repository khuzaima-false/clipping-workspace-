/**
 * Strict database model types shared across the workspace.
 */

export const CHANNEL_PLATFORMS = [
  "YouTube",
  "TikTok",
  "Instagram",
] as const;

export type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number];

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  /** First 1,000 accounts: 15 credits/day instead of 10. */
  is_founding_user: boolean;
  theme_preference: string;
  referral_code: string | null;
  /** Id of the user who referred this account (`/ref/[userId]`). */
  referred_by: string | null;
  /** Number of successful referrals this user has made. */
  referral_count: number;
  /** Export credits remaining for the current UTC day. */
  daily_credits: number;
  /** Timestamp of the last daily refill (UTC). */
  last_credit_reset: string;
  /** True while ad-free rewards are active. */
  is_ad_free: boolean;
  /** Expiry of the ad-free reward, or null for permanent. */
  ad_free_until: string | null;
  active_seconds: number;
  created_at: string;
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "display_name"
    | "theme_preference"
    | "daily_credits"
    | "last_credit_reset"
    | "is_ad_free"
    | "ad_free_until"
    | "referral_count"
    | "referred_by"
  >
>;

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  created_at: string;
}

export interface Channel {
  id: string;
  user_id: string;
  name: string;
  platform: ChannelPlatform;
  niche: string | null;
  url: string | null;
  notes: string | null;
  /** Optional mailbox used for the channel ownership check. */
  channel_email: string | null;
  created_at: string;
}

export interface ChannelInsert {
  user_id: string;
  name: string;
  platform: ChannelPlatform;
  niche: string | null;
  url: string | null;
  notes: string | null;
  channel_email: string | null;
}

export type ChannelUpdate = Partial<Omit<ChannelInsert, "user_id">>;

export interface Project {
  id: string;
  user_id: string;
  channel_id: string | null;
  title: string;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectInsert {
  user_id: string;
  channel_id: string | null;
  title: string;
  status: string;
  settings: Record<string, unknown>;
}

export type ProjectUpdate = Partial<Omit<ProjectInsert, "user_id">>;

export const PROJECT_STATUSES = [
  "draft",
  "in-progress",
  "ready",
  "exported",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
