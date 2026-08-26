import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain CommonJS, intentionally -- Electron's main/preload processes and
    // build-time Node scripts, not part of the TS/ESM app bundle.
    "electron/**/*.js",
    "scripts/**/*.js",
    "scripts/**/*.mjs",
  ]),
]);

export default eslintConfig;
