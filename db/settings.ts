import { config } from "dotenv";
import path from "path";

export function getConnection() {
  const isProduction = process.env.NODE_ENV === "production";
  const envFile = isProduction ? ".env.production" : ".env.development";
  const envFilePath = path.join(process.cwd(), envFile);
  console.log(`Loading environment variables from ${envFilePath}`);
  config({ path: envFilePath });

  return {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  };
}
