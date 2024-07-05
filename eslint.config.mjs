import pluginJs from "@eslint/js";
import globals from "globals";

export default [
  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: true,
      },
    },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["public/*.js"],
    languageOptions: {
      globals: {
        SparkMD5: true,
        ...globals.browser,
      },
    },
  },
];
