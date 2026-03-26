#!/usr/bin/env node

import { Command } from "commander";
import { runConfigureCommand } from "@/cli/commands/configure";
import {
  runPluginAddCommand,
  runPluginListCommand,
  runPluginRemoveCommand,
} from "@/cli/commands/plugin";
import { runSetupCommand } from "@/cli/commands/setup";
import { runInitCommand } from "@/cli/commands/local/init";
import { runStartCommand } from "@/cli/commands/local/start";
import { runNotifyCommand } from "@/cli/commands/local/notify";
import { runExportCommand, runImportCommand } from "@/cli/commands/local/export-import";
import { runMigrateCommand } from "@/cli/commands/local/migrate";
import { runCronInstallCommand } from "@/cli/commands/local/cron-install";
import { runUninstallCommand } from "@/cli/commands/local/uninstall";

async function main() {
  const program = new Command();

  program
    .name("s54r")
    .description("sub5tr4cker — manage shared subscriptions locally or self-hosted")
    .version(process.env.npm_package_version ?? "0.0.0");

  // ── local-first commands ───────────────────────────────────────────────────

  program
    .command("init")
    .description("Set up local mode (SQLite + notification channels)")
    .action(async () => {
      await runInitCommand();
    });

  program
    .command("start")
    .description("Start the dashboard web server on localhost:3054 (foreground)")
    .option("-p, --port <port>", "Port to listen on", (v) => parseInt(v, 10))
    .action(async (options: { port?: number }) => {
      await runStartCommand(options);
    });

  program
    .command("notify")
    .description("Poll Telegram + send due payment reminders (run from cron)")
    .action(async () => {
      await runNotifyCommand();
    });

  program
    .command("export")
    .description("Export all local data to a portable JSON file")
    .option("-o, --output <path>", "Output file path")
    .action(async (options: { output?: string }) => {
      await runExportCommand(options);
    });

  program
    .command("import <file>")
    .description("Import data from a JSON export file")
    .option("--dry-run", "Preview what would be imported without writing")
    .action(async (file: string, options: { dryRun?: boolean }) => {
      await runImportCommand(file, options);
    });

  program
    .command("migrate")
    .description("Migrate local SQLite data to MongoDB (upgrade to advanced mode)")
    .action(async () => {
      await runMigrateCommand();
    });

  program
    .command("cron-install")
    .description("Install OS-native scheduled task for automatic reminders")
    .action(async () => {
      await runCronInstallCommand();
    });

  program
    .command("uninstall")
    .description("Remove all local data and cron entries (prompts for backup first)")
    .action(async () => {
      await runUninstallCommand();
    });

  // ── advanced / MongoDB commands (kept for backward compatibility) ──────────

  program
    .command("setup")
    .description("Run the first-time setup wizard (advanced MongoDB mode)")
    .action(async () => {
      await runSetupCommand();
    });

  program
    .command("configure")
    .description("Re-run a specific setup section (advanced mode)")
    .option(
      "--section <section>",
      "Section to update: database, auth, email, telegram, or general"
    )
    .action(async (options: { section?: string }) => {
      await runConfigureCommand(options.section);
    });

  const pluginCmd = program
    .command("plugin")
    .description("Manage SubsTrack plugins (templates and notification channels)");

  pluginCmd
    .command("add <repo>")
    .description(
      "Install a plugin from a GitHub repo (e.g. owner/repo or owner/substrack-plugin-slack)"
    )
    .action(async (repo: string) => {
      await runPluginAddCommand(repo);
    });

  pluginCmd
    .command("remove <slug>")
    .description("Uninstall a plugin by slug")
    .action(async (slug: string) => {
      await runPluginRemoveCommand(slug);
    });

  pluginCmd
    .command("list")
    .description("List installed plugins")
    .action(async () => {
      await runPluginListCommand();
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
