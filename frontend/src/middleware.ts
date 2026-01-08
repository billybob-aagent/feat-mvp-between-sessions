import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * IMPORTANT:
 * We intentionally do NOT enforce auth in middleware.
 *
 * Reason:
 * - auth is cookie-based + refresh-token based
 * - middleware runs before client JS and can redirect prematurely
 * - we want layouts to call /auth/me (401 triggers /auth/refresh) and then continue
 *
 * Real security is enforced on the backend via guards.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
