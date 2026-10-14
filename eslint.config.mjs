import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // shadcn/ui CLI가 생성한 원본 코드는 최대한 그대로 둔다 (업데이트 시 diff를 작게 유지).
    // carousel.tsx가 effect 안에서 setState를 호출해 이 규칙에 걸리지만, 동작상 문제는 없다.
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // any 금지 (프로젝트 규칙)
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
