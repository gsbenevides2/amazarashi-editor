import { defineConfig } from "drizzle-kit";
import { getConnection } from "./settings";

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "turso",
  dbCredentials: getConnection(),
});
