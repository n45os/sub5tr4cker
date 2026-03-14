#!/usr/bin/env node

import { Command } from "commander";
import { runConfigureCommand } from "@/cli/commands/configure";
import {
  runPluginAddCommand,
  runPluginListCommand,
  runPluginRemoveCommand,
} from "@/cli/commands/plugin";
import { runSetupCommand } from "@/cli/commands/setup";

async function main() {
  const program = new Command();

  program
    .name("substrack")
    .description("SubsTrack setup and configuration tools");

  program
    .command("setup")
    .description("Run the first-time setup wizard")
    .action(async () => {
      await runSetupCommand();
    });

  program
    .command("configure")
    .description("Re-run a specific setup section")
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
