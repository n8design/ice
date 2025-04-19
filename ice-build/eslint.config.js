import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Add ignores globally at the top level
  {
    ignores: ["dist/**"], // Ignore the entire dist directory
  },

  ...tseslint.configs.recommended, // Apply base TS recommendations

  {
    files: ["**/*.ts"], // Apply to all TS files in this project
    languageOptions: {
      globals: { ...globals.node }, // Assume Node.js environment
      sourceType: "module",
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-useless-escape": "warn",
    },
  }
);