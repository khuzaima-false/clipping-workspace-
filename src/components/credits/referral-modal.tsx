"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Coins,
  Copy,
  Gift,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useWorkspaceStore } from "@/store/workspace";
import {
  adFreeDaysRemaining,
  dailyCreditLimit,
  REFERRALS_FOR_AD_FREE,
  referralUrl,
} from "@/lib/credits";

type ReferralModalProps = {
  open: boolean;
  onClose: () => void;
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
      <p className="text-[10px] text-zinc-600">{hint}</p>
    </div>
  );
}

export function ReferralModal({ open, onClose }: ReferralModalProps) {
  const profile = useWorkspaceStore((state) => state.profile);
  const loadProfile = useWorkspaceStore((state) => state.loadProfile);

  const [copied, setCopied] = useState(false);

  // Refresh referral counts whenever the modal opens.
  useEffect(() => {
    if (open) void loadProfile({ force: true });
  }, [open, loadProfile]);

  // Keep the time-based ad-free reward out of the static prerender.
  if (!open) return null;

  const userId = profile?.id ?? "";
  const url = userId ? referralUrl(userId) : "";
  const count = profile?.referral_count ?? 0;
  const remaining = Math.max(0, REFERRALS_FOR_AD_FREE - count);
  const progress = Math.min(
    100,
    Math.round((count / REFERRALS_FOR_AD_FREE) * 100)
  );
  const adFreeDays = adFreeDaysRemaining(profile);
  const limit = profile
    ? dailyCreditLimit(profile.is_founding_user)
    : 10;

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Referrals & Rewards"
      onClose={onClose}
      className="max-w-lg"
    >
      <div className="space-y-5">
        {adFreeDays > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-300">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              You&apos;re ad-free for {adFreeDays} more day
              {adFreeDays === 1 ? "" : "s"}. Thanks for spreading the word!
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            icon={Coins}
            label="Credits today"
            value={profile ? String(profile.daily_credits) : "—"}
            hint={`${limit} / day`}
          />
          <Stat
            icon={Users}
            label="Referrals"
            value={String(count)}
            hint={`${remaining} to ad-free`}
          />
          <Stat
            icon={ShieldCheck}
            label="Ad-free"
            value={adFreeDays > 0 ? `${adFreeDays}d` : "Off"}
            hint={profile?.is_founding_user ? "Founding user" : "Standard"}
          />
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Your referral link
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Sign in to generate your link"
              aria-label="Your referral link"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!url}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {!profile && (
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Sign in to generate your personal referral link.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-violet-400" aria-hidden />
              Ad-free reward progress
            </span>
            <span className="tabular-nums text-zinc-500">
              {count} / {REFERRALS_FOR_AD_FREE}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">
            {remaining > 0
              ? `Refer ${remaining} more friend${remaining === 1 ? "" : "s"} to unlock 90 days without ads.`
              : "Reward unlocked — enjoy your ad-free exporting."}
          </p>
        </div>

        <ul className="space-y-1.5 border-t border-zinc-800 pt-4 text-[11px] leading-4 text-zinc-500">
          <li>• Standard accounts get 20 credits every day (UTC).</li>
          <li>• Founding accounts (first 1,000) get 25 credits per day.</li>
          <li>• A 1080p export costs 2 credits · AI captions cost 3 credits.</li>
          <li>• 10 successful referrals unlock 90 days of ad-free exporting.</li>
        </ul>
      </div>
    </Modal>
  );
}
