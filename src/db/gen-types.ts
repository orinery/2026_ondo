/**
 * supabase-js용 DB 타입 생성 — `npm run db:types`
 * 실제 DB 스키마를 읽어 src/types/database.ts를 만든다. 마이그레이션을 적용한 뒤 다시 실행한다.
 *
 * 왜 스크립트로 감싸나: DATABASE_URL을 명령줄에 직접 쓰면 OS마다 환경 변수 문법이 다르고
 * (PowerShell `$env:X` / bash `$X`) 비밀번호가 셸 기록에 남을 수 있기 때문.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경 변수가 이미 주입된 경우
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL이 없습니다.");

// CLI의 진입점(JS 파일)을 node로 직접 실행한다. 셸을 거치지 않으므로
// 비밀번호의 특수문자가 셸에서 해석되거나 명령이 주입될 여지가 없다.
const cliPath = "node_modules/supabase/dist/supabase.js";
const output = execFileSync(
  process.execPath,
  [cliPath, "gen", "types", "typescript", "--db-url", databaseUrl, "--schema", "public"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

const header = "// 자동 생성 파일 — 직접 수정하지 말고 `npm run db:types`로 다시 만드세요.\n";
writeFileSync("src/types/database.ts", header + output);
console.log("✓ src/types/database.ts 생성");
