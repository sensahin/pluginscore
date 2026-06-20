import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const schemaPath = resolve(process.cwd(), "db/schema.sql");
const schema = await readFile(schemaPath, "utf8");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(schema);
  console.log("PluginScore database schema is up to date.");
} finally {
  await pool.end();
}
