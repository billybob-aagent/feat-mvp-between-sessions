import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const frontendHost = req.nextUrl.host;
  let apiHost: string | null = null;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase) {
    try {
      apiHost = new URL(apiBase).host;
    } catch {
      apiHost = null;
    }
  }

  // allow public routes
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const access = req.cookies.get("access_token")?.value;
  const refresh = req.cookies.get("refresh_token")?.value;

  // protect app routes
  if (pathname.startsWith("/app")) {
    // When frontend and API are on different hosts (e.g., Render public suffix),
    // the browser cannot send API-domain cookies to the frontend domain.
    // We skip cookie gating here and rely on backend auth + useMe() to enforce access.
    if (apiHost && apiHost !== frontendHost) {
      return NextResponse.next();
    }

    if (!access && !refresh) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // ✅ FIXED
  matcher: ["/app/:path*"],
};
