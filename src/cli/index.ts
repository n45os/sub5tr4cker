#!/usr/bin/env node

import { Command } from "commander";
import { runConfigureCommand } from "@/cli/commands/configure";
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

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
