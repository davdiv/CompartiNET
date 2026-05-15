import { defineConfig } from "vitest/config";
import babel from "@rolldown/plugin-babel";
import { signaliumPreset } from "signalium/transform";
import { schemaPlugin } from "./vite.schemaplugin";
import { unshareForkPool } from "./tests/unshareForkPool";

export default defineConfig({
  plugins: [
    babel({
      presets: [signaliumPreset()],
    }),
    schemaPlugin(),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          pool: unshareForkPool(),
        },
      },
    ],
    coverage: {
      exclude: ["tests/**"],
    },
  },
});
