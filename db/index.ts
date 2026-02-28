import { drizzle } from "drizzle-orm/libsql";
import { getConnection } from "./settings";
import * as schema from "./schema";

export function connectToDatabase() {
  const db = drizzle({ connection: getConnection(), schema });
  return db;
}
