import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "../../../../db";
import { sessionsTable } from "../../../../db/schema";
import { getOauthClient, getRedirectUri } from "../utils";

const db = connectToDatabase();

async function generateAndSaveSessionToken() {
  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Expires in 30 days
  await db.insert(sessionsTable).values({
    sessionToken: sessionId,
    expires,
  });
  return { sessionId, expires };
}

async function generateGoogleOAuthUrl(req: NextRequest) {
  const oauth2Client = getOauthClient(getRedirectUri(req));
  const scopes = ["https://www.googleapis.com/auth/userinfo.email"];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
  return authUrl;
}

export async function GET(req: NextRequest) {
  const { sessionId, expires } = await generateAndSaveSessionToken();
  const authUrl = await generateGoogleOAuthUrl(req);

  const response = new NextResponse("", {
    status: 301,
    headers: {
      Location: authUrl,
    },
  });
  response.cookies.set("next-auth.session-token", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
  });
  return response;
}
