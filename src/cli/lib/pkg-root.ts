import { dirname, join } from "path";
import { existsSync, readFileSync } from "fs";

let _pkgRoot: string | null = null;

/**
 * Resolves the sub5tr4cker package root directory.
 * Works from both development (tsx src/cli/index.ts) and production
 * (dist/cli/index.js after global npm install).
 */
export function getPackageRoot(): string {
  if (_pkgRoot) return _pkgRoot;

  // walk up from the file being executed until we find our package.json
  let dir = dirname(__filename);
  while (true) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "sub5tr4cker") {
          _pkgRoot = dir;
          return dir;
        }
      } catch {
        // corrupted package.json — keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // fallback: assume cwd is the package root (dev scenario)
  _pkgRoot = process.cwd();
  return _pkgRoot;
}
