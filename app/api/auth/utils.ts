import { google } from "googleapis";

export function getOauthClient(redirectUri: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
  return oauth2Client;
}

export function getRedirectUri(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/api/auth/google";
  url.search = ""; // Clear any existing query parameters
  return url.toString();
}
