import { createBaseConfig } from "../eslint.config.base.js";

export default [
  ...createBaseConfig("./tsconfig.json"),
  {
    files: ["**/*.ts"],
    rules: {
      // Project-specific rules for ice-hotreloader
    },
  },
];