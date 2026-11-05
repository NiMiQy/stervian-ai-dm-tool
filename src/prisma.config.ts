import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
    "seed": "tsx src/prisma/seed.ts"
  },
  datasource: {
    url: env("DB_URL"), // Maps your database environment variable
  },
});
