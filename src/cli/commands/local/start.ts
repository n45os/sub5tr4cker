import * as p from "@clack/prompts";
import path from "path";
import { spawn } from "child_process";
import { readConfig, getDbPath } from "@/lib/config/manager";
import { existsSync } from "fs";
import { getPackageRoot } from "@/cli/lib/pkg-root";

export async function runStartCommand(options: { port?: number } = {}): Promise<void> {
  const config = readConfig();
  if (!config) {
    p.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }

  const port = options.port ?? config.port ?? 3054;
  const pkgRoot = getPackageRoot();
  const standaloneServer = path.join(pkgRoot, ".next", "standalone", "server.js");
  const buildId = path.join(pkgRoot, ".next", "BUILD_ID");

  if (!existsSync(buildId)) {
    p.log.error("No Next.js build found. Run 's54r init' first, or 'pnpm build'.");
    process.exit(1);
  }

  p.intro(`  sub5tr4cker — starting on http://localhost:${port}  `);
  p.log.info(`Data directory: ${getDbPath()}`);
  p.log.info(`Press Ctrl+C to stop.`);

  // set env vars for local mode — apply to the current process first so that
  // anything running in-process (e.g. Telegram polling) sees the same values
  process.env.SUB5TR4CKER_MODE = "local";
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();
  process.env.SUB5TR4CKER_AUTH_TOKEN = config.authToken ?? "";
  process.env.AUTH_SECRET = config.authToken ?? "sub5tr4cker-local-fallback";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "localhost";
  process.env.NEXTAUTH_URL = `http://localhost:${port}`;

  // pass the same env to the child process
  const env: NodeJS.ProcessEnv = { ...process.env };

  // local mode loads better-sqlite3 (native addon). Next's `output: standalone` bundle
  // copies JS into `.next/standalone/node_modules` but not compiled `.node` bindings,
  // so `node .next/standalone/server.js` breaks with "Could not locate the bindings file".
  // Prefer `next start` from the package root whenever the CLI is present — that resolves
  // better-sqlite3 from the real `node_modules` tree (after `pnpm install`).
  // Fall back to standalone only when `next` is missing (e.g. some minimal global installs).
  const nextBin = path.join(pkgRoot, "node_modules", ".bin", "next");
  let child: ReturnType<typeof spawn>;

  if (existsSync(nextBin)) {
    child = spawn(nextBin, ["start", "--port", String(port)], {
      env,
      stdio: "inherit",
      cwd: pkgRoot,
    });
  } else if (existsSync(standaloneServer)) {
    child = spawn("node", [standaloneServer], {
      env,
      stdio: "inherit",
      cwd: path.join(pkgRoot, ".next", "standalone"),
    });
  } else {
    p.log.error(
      "No Next.js start path found. Install dependencies (pnpm install) and run s54r init / pnpm build."
    );
    process.exit(1);
  }

  child.on("error", (e) => {
    p.log.error(`Failed to start server: ${e.message}`);
    process.exit(1);
  });

  // start Telegram long-polling if configured
  if (config.notifications.channels.telegram?.botToken) {
    p.log.info("Starting Telegram long-polling...");
    const { startPolling } = await import("@/lib/telegram/polling");
    startPolling().catch((e) => {
      p.log.warn(`Telegram polling error: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  // best-effort open in the default browser after startup
  setTimeout(() => {
    void openBrowser(`http://localhost:${port}`);
  }, 1500);

  process.on("SIGINT", () => { child.kill("SIGINT"); process.exit(0); });
  process.on("SIGTERM", () => { child.kill("SIGTERM"); process.exit(0); });

  // wait for child to exit
  await new Promise<void>((resolve) => {
    child.on("exit", (code) => {
      if (code && code !== 0) {
        p.log.error(`Server exited with code ${code}`);
      }
      resolve();
    });
  });
}


async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";

  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
    shell: platform === "win32",
  });
  child.unref();
}
