// This file configures Prisma for the project
import "dotenv/config";

const defineConfig = (config: any) => config;
const env = (key: string) => process.env[key];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});