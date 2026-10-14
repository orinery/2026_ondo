import { defineConfig } from "drizzle-kit";

// drizzle-kit은 Next.js처럼 .env.local을 자동으로 읽지 않으므로 Node 내장 기능으로 불러온다.
// generate(SQL 파일 생성)는 DB 접속이 필요 없어서 파일이 없어도 동작하게 둔다.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local이 없으면 migrate/studio만 실패한다
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  // public 스키마만 관리한다 (auth, storage 등 Supabase 내부 스키마는 건드리지 않음)
  schemaFilter: ["public"],
  // anon / authenticated 같은 Supabase 기본 역할은 이미 있으므로 생성하지 않는다
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
