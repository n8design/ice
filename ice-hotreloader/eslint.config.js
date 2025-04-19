import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Add ignores globally at the top level
  {
    ignores: ["dist/**"], // Ignore the entire dist directory
  },

  // Apply base recommended TypeScript rules globally first
  ...tseslint.configs.recommended,

  // Configuration for Node.js specific files
  {
    files: ["**/*.ts"], // Apply to all TS files initially
    ignores: ["src/browser.ts"], // EXCLUDE browser file from Node rules
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "module",
    },
    rules: {
      // Inherit recommended rules (already applied globally, but safe to repeat)
      ...tseslint.configs.recommended.rules,
      // Override for Node environment
      "no-console": "off", // Allow console logs
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-useless-escape": "warn",
    },
  },

  // Configuration for Browser specific files
  {
    files: ["src/browser.ts"], // Target ONLY the browser file
    languageOptions: {
      globals: { ...globals.browser }, // Apply Browser globals
      sourceType: "module",
    },
    rules: {
      // Inherit recommended rules
      ...tseslint.configs.recommended.rules,
      // Add specific overrides for browser code if needed
      // "no-console": "warn", // Example: Warn console in browser
    },
  }
);