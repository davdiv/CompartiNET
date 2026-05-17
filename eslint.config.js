import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { builtinModules } from "node:module";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  { ignores: ["dist", "coverage", "src/node/netnsWorker/netns-worker.js", "src/node/manage-netns.js"] },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.ts"],
        },
      },
    },
    rules: {
      "no-restricted-imports": ["error", { paths: builtinModules }],
      "@typescript-eslint/return-await": ["error", "always"],
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["src/common/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: builtinModules,
          patterns: [
            { group: ["**/node/**"] },
            {
              group: ["node:*"],
              // TODO: find a way to avoid this exception:
              allowImportNames: ["isDeepStrictEqual"],
            },
          ],
        },
      ],
    },
  },
);
