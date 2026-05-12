import { chmod, cp, writeFile } from "fs/promises";
import { defineConfig } from "vite";
import babel from "@rolldown/plugin-babel";
import { signaliumPreset } from "signalium/transform";
import packageJson from "./package.json";
import { schemaPlugin } from "./vite.schemaplugin";
import { readdirSync } from "fs";

const commands = new Set(readdirSync("./src/node/cli"));
const externalCommands = new Set([...commands].filter((cmd) => cmd.startsWith("compartinet")));

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: true,
    lib: {
      entry: Object.fromEntries([...commands].map((command) => [command, `src/node/cli/${command}/main.ts`])),
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: (chunkInfo) => chunkInfo.name,
        banner: (chunk) => (chunk.isEntry && externalCommands.has(chunk.name) ? "#!/usr/bin/env -S node\n" : ""),
      },
    },
  },
  plugins: [
    schemaPlugin(),
    babel({
      presets: [signaliumPreset()],
    }),
    {
      name: "extra",
      async writeBundle() {
        for (const command of externalCommands) {
          await chmod(`dist/${command}`, 0o755);
        }
        await cp("README.md", "dist/README.md");
        await cp("LICENSE.md", "dist/LICENSE.md");
        const pkg: Partial<typeof packageJson & { bin: Record<string, string> }> = { ...packageJson };
        delete pkg.scripts;
        delete pkg.devDependencies;
        delete pkg.private;
        pkg.bin = Object.fromEntries([...externalCommands].map((command) => [command, command]));
        await writeFile("dist/package.json", JSON.stringify(pkg));
      },
    },
  ],
});
