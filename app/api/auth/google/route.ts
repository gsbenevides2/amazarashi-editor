import { NextRequest, NextResponse } from "next/server";
import { getOauthClient, getRedirectUri } from "../utils";
import { google } from "googleapis";
import { sessionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { connectToDatabase } from "@/db";

async function validateGoogleOAuthCode(code: string, req: NextRequest) {
  const oauth2Client = getOauthClient(getRedirectUri(req));
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;
    if (!userEmail) {
      throw new Error("Unable to retrieve user email from Google");
    }
    const allowedEmails =
      process.env.GOOGLE_CLIENT_ALLOWED_EMAILS?.split(",") || [];
    if (!allowedEmails.includes(userEmail)) {
      throw new Error("Unauthorized email");
    }
    return true;
  } catch (error) {
    console.error("Google OAuth validation error:", error);
    return false;
  }
}

async function markSessionAsLogged(sessionToken: string) {
  const db = await connectToDatabase();
  await db
    .update(sessionsTable)
    .set({ logged: true })
    .where(eq(sessionsTable.sessionToken, sessionToken));
}

export async function GET(req: NextRequest) {
  const codeParam = req.nextUrl.searchParams.get("code");
  const sessionToken = req.cookies.get("next-auth.session-token")?.value;

  if (!codeParam) {
    return new NextResponse("Missing code parameter", {
      status: 301,
      headers: { Location: "/api/auth/error" },
    });
  }
  if (!sessionToken) {
    return new NextResponse("Missing session token", {
      status: 301,
      headers: { Location: "/api/auth/error" },
    });
  }

  const valid = await validateGoogleOAuthCode(codeParam, req);
  if (!valid) {
    return new NextResponse("Invalid code or unauthorized email", {
      status: 301,
      headers: { Location: "/api/auth/error" },
    });
  }

  await markSessionAsLogged(sessionToken);
  return new NextResponse("Successfully authenticated", {
    status: 301,
    headers: { Location: "/" },
  });
}
