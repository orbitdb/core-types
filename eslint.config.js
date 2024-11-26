import eslint from "@eslint/js";
import globals from "globals";
import { configs as configsTseslint } from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/**"],
  },
  eslint.configs.recommended,
  ...configsTseslint.recommended,
  {
    files: ["**/*.d.{ts}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 12,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    ignores: ["**/node_modules/**", "**/dist/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
