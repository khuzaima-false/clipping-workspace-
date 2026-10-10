import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 request proxy (formerly `middleware.ts`).
 * Refreshes Supabase auth session cookies on every page/navigation request.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on every request except static assets and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
