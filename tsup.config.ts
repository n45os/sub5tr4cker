import { defineConfig } from "tsup";
import { resolve } from "path";
import { existsSync } from "fs";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["cjs"],
  target: "node18",
  outDir: "dist/cli",
  clean: true,
  splitting: false,
  // shebang is preserved from source (src/cli/index.ts line 1)
  // keep node_modules as external — they're installed as dependencies
  packages: "external",
  esbuildPlugins: [
    {
      name: "resolve-at-alias",
      setup(build) {
        // resolve @/foo/bar → src/foo/bar (.ts, .tsx, or /index.ts)
        // does NOT match scoped packages like @auth/ or @base-ui/
        build.onResolve({ filter: /^@\// }, (args) => {
          const rel = args.path.slice(2);
          const base = resolve("src", rel);

          for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
            if (existsSync(base + ext)) return { path: base + ext };
          }
          for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
            const idx = resolve(base, "index" + ext);
            if (existsSync(idx)) return { path: idx };
          }

          return undefined;
        });
      },
    },
  ],
});
