import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Allow internal server-to-server calls (cron, scripts, etc.)
  if (req.headers.get("x-internal-key") === process.env.INTERNAL_API_KEY) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /api/webhooks (external webhooks like Unipile)
     * - /_next (Next.js internals)
     * - /favicon.ico, /sw.js, static files
     */
    // api/agent-avatar must stay public: <img src> requests often omit auth cookies in edge cases; a redirect breaks icons.
    "/((?!login|api/auth|api/webhooks|api/agent-avatar|_next|favicon\\.ico|sw\\.js|.*\\.).*)",
  ],
};
