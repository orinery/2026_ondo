import { z } from "zod";

/**
 * 브라우저에도 노출되는 공개 환경 변수 검증.
 * NEXT_PUBLIC_ 값은 빌드 시점에 코드에 그대로 박히므로 `process.env.NEXT_PUBLIC_X`처럼
 * 정적으로 접근해야 한다(동적 키 접근은 치환되지 않음).
 * 서버 전용 값(DATABASE_URL, SUPABASE_SECRET_KEY)은 앱 코드에서 쓰지 않으므로 여기에 두지 않는다.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
