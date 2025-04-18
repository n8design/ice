import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

/**
 * @param {string} tsconfigPath - Path to tsconfig.json
 */
export function createBaseConfig(tsconfigPath = "./tsconfig.json") {
  return [
    {
      ignores: ["node_modules/**", "dist/**", "*.js"],
    },
    {
      files: ["**/*.ts"],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          project: tsconfigPath,
          tsconfigRootDir: '.',
          lib: ["ES2022", "DOM", "DOM.Iterable"],
        },
        globals: {
          ...globals.node,
          ...globals.browser,
        },
      },
      plugins: {
        "@typescript-eslint": ts,
      },
      rules: {
        ...js.configs.recommended.rules,
        ...ts.configs.recommended.rules,
        // Common rules for all projects
        "no-console": "warn",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
      },
    },
  ];
}

export default createBaseConfig();