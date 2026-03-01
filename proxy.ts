import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "./db";
import { sessionsTable } from "./db/schema";
import { and, eq, gt } from "drizzle-orm";

async function testIsValidSession(sessionToken: string | undefined) {
  if (!sessionToken) return false;
  const db = await connectToDatabase();
  const testResult = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.sessionToken, sessionToken),
        gt(sessionsTable.expires, new Date()),
        eq(sessionsTable.logged, true),
      ),
    )
    .limit(1);
  return testResult.length > 0;
}

export default async function middleware(req: NextRequest) {
  const sessionToken = req.cookies.get("next-auth.session-token")?.value;
  const isValidSession = await testIsValidSession(sessionToken);
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  if (!isAuthRoute && !isValidSession) {
    return NextResponse.redirect(new URL("/api/auth/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
