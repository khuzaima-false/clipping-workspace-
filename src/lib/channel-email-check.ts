export type OwnershipCheckResult = {
  ok: boolean;
  reason: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Channel email ownership check.
 *
 * Verifies that the supplied mailbox is syntactically valid and that its
 * domain publishes an MX record, i.e. it can actually receive the ownership
 * email we would send. Uses public DNS-over-HTTPS, so it has no side effects.
 */
export async function checkChannelEmailOwnership(
  email: string
): Promise<OwnershipCheckResult> {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false, reason: "Enter a valid email address." };
  }

  const domain = normalized.split("@")[1];
  if (!domain) {
    return { ok: false, reason: "Enter a valid email address." };
  }

  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: "application/dns-json" } }
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: "Could not verify the domain (DNS lookup failed).",
      };
    }

    const payload = (await response.json()) as {
      Answer?: Array<{ type: number }>;
      Status?: number;
    };

    const hasMx = Array.isArray(payload.Answer)
      ? payload.Answer.some((record) => record.type === 15)
      : false;

    if (!hasMx) {
      return {
        ok: false,
        reason: `${domain} has no MX record, so it cannot receive an ownership email.`,
      };
    }

    return {
      ok: true,
      reason: `${domain} accepts email (MX record found) — ownership email can be delivered.`,
    };
  } catch {
    return {
      ok: false,
      reason: "Network error while checking the domain. Try again.",
    };
  }
}
