import * as p from "@clack/prompts";
import { spawn } from "child_process";
import { readConfig, getDbPath } from "@/lib/config/manager";
import { existsSync } from "fs";

export async function runStartCommand(options: { port?: number } = {}): Promise<void> {
  const config = readConfig();
  if (!config) {
    p.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }

  const port = options.port ?? config.port ?? 3054;

  // check that the build exists
  const buildDir = new URL("../../../../.next", import.meta.url).pathname;
  if (!existsSync(buildDir)) {
    p.log.warn("No Next.js build found. Building now (this may take a minute)...");
    await build();
  }

  p.intro(`  sub5tr4cker — starting on http://localhost:${port}  `);
  p.log.info(`Data directory: ${getDbPath()}`);
  p.log.info(`Press Ctrl+C to stop.`);

  // set env vars for local mode
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SUB5TR4CKER_MODE: "local",
    SUB5TR4CKER_DATA_PATH: getDbPath(),
    SUB5TR4CKER_AUTH_TOKEN: config.authToken ?? "",
    PORT: String(port),
    NEXTAUTH_URL: `http://localhost:${port}`,
  };

  // start next.js in production mode (foreground, Ctrl+C to stop)
  const child = spawn("node", [".next/standalone/server.js"], {
    env,
    stdio: "inherit",
    cwd: process.cwd(),
  });

  // also try dev mode if standalone build doesn't exist
  child.on("error", () => {
    p.log.warn("Standalone server not found, trying next start...");
    const dev = spawn(
      "node_modules/.bin/next",
      ["start", "--port", String(port)],
      { env, stdio: "inherit", cwd: process.cwd() }
    );
    dev.on("error", (e) => {
      p.log.error(`Failed to start server: ${e.message}`);
      process.exit(1);
    });
    process.on("SIGINT", () => { dev.kill("SIGINT"); process.exit(0); });
    process.on("SIGTERM", () => { dev.kill("SIGTERM"); process.exit(0); });
  });

  // start Telegram long-polling if configured (in a separate background process
  // so it doesn't block the web server startup)
  if (config.notifications.channels.telegram?.botToken) {
    p.log.info("Starting Telegram long-polling...");
    const { startPolling } = await import("@/lib/telegram/polling");
    // run polling in parallel — errors are non-fatal
    startPolling().catch((e) => {
      p.log.warn(`Telegram polling error: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

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

async function build(): Promise<void> {
  const { execSync } = await import("child_process");
  execSync("node_modules/.bin/next build", {
    stdio: "inherit",
    env: { ...process.env, SUB5TR4CKER_MODE: "local" },
  });
}
