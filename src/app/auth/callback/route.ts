import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth code-exchange callback.
 * Handles `?code=` from email confirmation / OAuth / magic-link redirects.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";

  // Only allow same-origin relative redirects (blocks open redirects).
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth] code exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
